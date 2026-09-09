"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { money, toDbString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  addReceiptLineItemSchema,
  approveReceiptSchema,
  receiptLineItemCsvRowSchema,
  rejectReceiptSchema,
  updateReceiptFieldsSchema,
  type AddReceiptLineItemInput,
  type ApproveReceiptInput,
  type RejectReceiptInput,
  type UpdateReceiptFieldsInput,
} from "@/lib/validation/accounting";

const QUEUE_STATUSES = ["uploaded", "processing", "needs_review", "ocr_failed"] as const;

export async function updateReceiptFieldsAction(
  input: UpdateReceiptFieldsInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = updateReceiptFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("receipts")
    .update({
      vendor_name: parsed.data.vendorName ?? null,
      receipt_date: parsed.data.receiptDate ?? null,
      amount:
        parsed.data.amount !== undefined
          ? toDbString(money(parsed.data.amount))
          : null,
      category: parsed.data.category ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.receiptId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/receipts/review/${parsed.data.receiptId}`);
  return { ok: true };
}

export async function approveReceiptAction(
  input: ApproveReceiptInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = approveReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_receipt", {
    p_receipt_id: parsed.data.receiptId,
    p_debit_account_id: parsed.data.debitAccountId ?? null,
    p_credit_account_id: parsed.data.creditAccountId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/receipts/review");
  return { ok: true };
}

export async function rejectReceiptAction(
  input: RejectReceiptInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = rejectReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_receipt", {
    p_receipt_id: parsed.data.receiptId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/receipts/review");
  return { ok: true };
}

export async function markReceiptDuplicateAction(
  receiptId: string,
  duplicateOfId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_receipt_duplicate", {
    p_receipt_id: receiptId,
    p_duplicate_of_id: duplicateOfId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/receipts/review");
  return { ok: true };
}

/** Finds the next queued item for the same client — powers the "review
 * this client's next transaction" flow after a commit. Returns null when
 * that client's queue is empty, so the caller falls back to the main
 * queue. */
export async function getNextQueuedReceiptAction(
  clientId: string,
  excludeReceiptId: string,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipts")
    .select("id")
    .eq("client_id", clientId)
    .neq("id", excludeReceiptId)
    .in("status", QUEUE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function addReceiptLineItemAction(
  input: AddReceiptLineItemInput,
): Promise<ActionResult> {
  const parsed = addReceiptLineItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { count: existingCount } = await supabase
    .from("receipt_line_items")
    .select("id", { count: "exact", head: true })
    .eq("receipt_id", parsed.data.receiptId);

  const { error } = await supabase.from("receipt_line_items").insert({
    receipt_id: parsed.data.receiptId,
    description: parsed.data.description,
    amount: toDbString(money(parsed.data.amount)),
    category: parsed.data.category || null,
    account_id: parsed.data.accountId || null,
    sequence: (existingCount ?? 0) + 1,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/receipts/review/${parsed.data.receiptId}`);
  return { ok: true };
}

export async function setReceiptLineItemAccountAction(
  lineItemId: string,
  receiptId: string,
  accountId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_line_items")
    .update({ account_id: accountId || null })
    .eq("id", lineItemId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/receipts/review/${receiptId}`);
  return { ok: true };
}

export async function deleteReceiptLineItemAction(
  lineItemId: string,
  receiptId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("receipt_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/receipts/review/${receiptId}`);
  return { ok: true };
}

/** Parses a pasted or uploaded CSV (description,amount,category) into
 * line items for this receipt — the "speed up admin review" path for a
 * customer who already has the breakdown in a spreadsheet. */
export async function importReceiptLineItemsCsvAction(
  receiptId: string,
  csvText: string,
): Promise<ActionResult & { count?: number }> {
  const lines = csvText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { ok: false, error: "The CSV is empty." };
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const hasHeader = header.includes("description") && header.includes("amount");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const descIdx = hasHeader ? header.indexOf("description") : 0;
  const amountIdx = hasHeader ? header.indexOf("amount") : 1;
  const categoryIdx = hasHeader ? header.indexOf("category") : 2;

  const rows: { description: string; amount: number; category?: string }[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const cells = dataLines[i].split(",").map((c) => c.trim());
    const parsed = receiptLineItemCsvRowSchema.safeParse({
      description: cells[descIdx],
      amount: cells[amountIdx],
      category: categoryIdx >= 0 ? cells[categoryIdx] : undefined,
    });
    if (!parsed.success) {
      return {
        ok: false,
        error: `Row ${i + (hasHeader ? 2 : 1)}: ${parsed.error.issues[0]?.message ?? "invalid row"}.`,
      };
    }
    rows.push(parsed.data);
  }
  if (rows.length === 0) {
    return { ok: false, error: "No data rows found." };
  }

  const supabase = await createClient();
  const { count: existingCount } = await supabase
    .from("receipt_line_items")
    .select("id", { count: "exact", head: true })
    .eq("receipt_id", receiptId);

  const { error } = await supabase.from("receipt_line_items").insert(
    rows.map((row, i) => ({
      receipt_id: receiptId,
      description: row.description,
      amount: toDbString(money(row.amount)),
      category: row.category || null,
      sequence: (existingCount ?? 0) + i + 1,
    })),
  );
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/receipts/review/${receiptId}`);
  return { ok: true, count: rows.length };
}
