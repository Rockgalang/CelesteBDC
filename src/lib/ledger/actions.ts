"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { parseImportCsv } from "@/lib/ledger/csv";
import { toDbString, money } from "@/lib/money";
import {
  manualLedgerEntrySchema,
  type ManualLedgerEntryInput,
} from "@/lib/validation/ledger";
import type { LedgerImportRowStatus } from "@/lib/supabase/types";

function revalidateLedgerPaths(clientId: string) {
  revalidatePath("/reports");
  revalidatePath(`/clients/${clientId}/books`);
}

/** Manual ledger entries are the client's own record (RLS lets
 * client_admin/client_user fully manage their own client's rows, and
 * owner/staff manage any client's) — these actions validate the caller
 * actually owns clientId (for non-staff) and give clean error messages;
 * RLS is still the real authorization boundary underneath. */
export async function addManualLedgerEntryAction(
  clientId: string,
  input: ManualLedgerEntryInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!isInternalRole(profile.role) && profile.client_id !== clientId) {
    return { ok: false, error: "You can only add entries to your own business." };
  }

  const parsed = manualLedgerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("manual_ledger_entries").insert({
    client_id: clientId,
    entry_type: parsed.data.entryType,
    entry_date: parsed.data.entryDate,
    description: parsed.data.description,
    amount: toDbString(money(parsed.data.amount)),
    category: parsed.data.category || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}

export async function updateManualLedgerEntryAction(
  id: string,
  clientId: string,
  input: ManualLedgerEntryInput,
): Promise<ActionResult> {
  const parsed = manualLedgerEntrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_ledger_entries")
    .update({
      entry_type: parsed.data.entryType,
      entry_date: parsed.data.entryDate,
      description: parsed.data.description,
      amount: toDbString(money(parsed.data.amount)),
      category: parsed.data.category || null,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}

export async function deleteManualLedgerEntryAction(
  id: string,
  clientId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_ledger_entries")
    .delete()
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}

/** Parses a CSV, flags rows that look like they duplicate an existing
 * manual entry or receipt for this client (same date + amount +
 * description), and lands everything as a pending import batch — nothing
 * is posted to the books yet. Only owner/staff can commit it from there. */
export async function uploadLedgerImportAction(
  clientId: string,
  filename: string,
  csvText: string,
): Promise<ActionResult & { batchId?: string }> {
  const profile = await getCurrentProfile();
  if (!isInternalRole(profile.role) && profile.client_id !== clientId) {
    return { ok: false, error: "You can only import for your own business." };
  }

  const parsed = parseImportCsv(csvText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const supabase = await createClient();

  const [{ data: existingEntries }, { data: existingReceipts }] = await Promise.all([
    supabase
      .from("manual_ledger_entries")
      .select("entry_date, amount, description")
      .eq("client_id", clientId),
    supabase
      .from("receipts")
      .select("receipt_date, amount, vendor_name")
      .eq("client_id", clientId)
      .not("receipt_date", "is", null)
      .not("amount", "is", null),
  ]);

  const existingKeys = new Set([
    ...(existingEntries ?? []).map(
      (e) => `${e.entry_date}|${Number(e.amount).toFixed(2)}|${e.description.toLowerCase()}`,
    ),
    ...(existingReceipts ?? []).map(
      (r) =>
        `${r.receipt_date}|${Number(r.amount).toFixed(2)}|${(r.vendor_name ?? "").toLowerCase()}`,
    ),
  ]);

  const { data: batch, error: batchError } = await supabase
    .from("ledger_import_batches")
    .insert({
      client_id: clientId,
      filename,
      row_count: parsed.rows.length,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return {
      ok: false,
      error: `Could not create import batch: ${batchError?.message ?? "unknown error"}`,
    };
  }

  const seenInFile = new Map<string, number>();
  let flaggedCount = 0;
  const rowsToInsert = parsed.rows.map((row) => {
    const key = `${row.entryDate}|${row.amount.toFixed(2)}|${row.description.toLowerCase()}`;
    const dupInBooks = existingKeys.has(key);
    const dupInFile = seenInFile.has(key);
    seenInFile.set(key, (seenInFile.get(key) ?? 0) + 1);

    const flagged = dupInBooks || dupInFile;
    if (flagged) flaggedCount += 1;

    return {
      batch_id: batch.id,
      row_number: row.rowNumber,
      entry_type: row.entryType,
      entry_date: row.entryDate,
      description: row.description,
      amount: toDbString(money(row.amount)),
      category: row.category,
      status: flagged ? ("flagged" as const) : ("pending" as const),
      flag_reason: dupInBooks
        ? "Matches an existing entry (same date, amount, description)"
        : dupInFile
          ? "Duplicate row within this file"
          : null,
    };
  });

  const { error: rowsError } = await supabase
    .from("ledger_import_rows")
    .insert(rowsToInsert);
  if (rowsError) {
    await supabase.from("ledger_import_batches").delete().eq("id", batch.id);
    return { ok: false, error: `Could not save rows: ${rowsError.message}` };
  }

  if (flaggedCount > 0) {
    await supabase
      .from("ledger_import_batches")
      .update({ flagged_count: flaggedCount })
      .eq("id", batch.id);
  }

  revalidateLedgerPaths(clientId);
  return { ok: true, batchId: batch.id };
}

export async function setLedgerImportRowStatusAction(
  rowId: string,
  clientId: string,
  status: LedgerImportRowStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_ledger_import_row_status", {
    p_row_id: rowId,
    p_status: status,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}

export async function commitLedgerImportBatchAction(
  batchId: string,
  clientId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("commit_ledger_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}

export async function rejectLedgerImportBatchAction(
  batchId: string,
  clientId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_ledger_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateLedgerPaths(clientId);
  return { ok: true };
}
