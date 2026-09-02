"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { money, toDbString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  createBankAccountSchema,
  type CreateBankAccountInput,
} from "@/lib/validation/accounting";

export async function createBankAccountAction(
  input: CreateBankAccountInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = createBankAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bank_accounts").insert({
    client_id: parsed.data.clientId,
    bank_name: parsed.data.bankName,
    account_name: parsed.data.accountName,
    account_number_last4: parsed.data.accountNumberLast4 ?? null,
    gl_account_id: parsed.data.glAccountId ?? null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/accounting/bank`);
  return { ok: true };
}

// Minimal CSV parser: comma-separated, no quoted-field support — matches
// the plain "date,description,amount[,reference]" exports most Philippine
// bank portals produce. A header row is detected and skipped when its
// third column doesn't parse as a number.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export async function importBankTransactionsAction(
  formData: FormData,
): Promise<ActionResult & { imported?: number; skipped?: number }> {
  await requireRole("owner", "staff");

  const bankAccountId = formData.get("bankAccountId");
  const clientId = formData.get("clientId");
  const file = formData.get("file");

  if (typeof bankAccountId !== "string" || typeof clientId !== "string") {
    return { ok: false, error: "Missing bank account." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to import." };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ok: false, error: "The file is empty." };
  }

  const first = rows[0];
  const startIndex = first && Number.isNaN(Number(first[2])) ? 1 : 0;

  type ParsedRow = {
    txn_date: string;
    description: string;
    amount: string;
    external_ref: string;
  };
  const parsedRows: ParsedRow[] = [];
  for (const row of rows.slice(startIndex)) {
    const [date, description, amountRaw, ref] = row;
    const amountNum = Number(amountRaw);
    if (!date || !description || Number.isNaN(amountNum)) continue;
    const externalRef =
      ref && ref.length > 0
        ? ref
        : createHash("sha256")
            .update(`${date}|${description}|${amountNum}`)
            .digest("hex")
            .slice(0, 40);
    parsedRows.push({
      txn_date: date,
      description,
      amount: toDbString(money(amountNum)),
      external_ref: externalRef,
    });
  }

  if (parsedRows.length === 0) {
    return { ok: false, error: "No valid rows found in the file." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("bank_transactions")
    .select("external_ref")
    .eq("bank_account_id", bankAccountId)
    .not("external_ref", "is", null);
  const existingRefs = new Set((existing ?? []).map((r) => r.external_ref));

  const newRows = parsedRows.filter((r) => !existingRefs.has(r.external_ref));
  const skipped = parsedRows.length - newRows.length;

  if (newRows.length === 0) {
    return { ok: true, imported: 0, skipped };
  }

  const importBatchId = randomUUID();
  const { error } = await supabase.from("bank_transactions").insert(
    newRows.map((r) => ({
      bank_account_id: bankAccountId,
      client_id: clientId,
      txn_date: r.txn_date,
      description: r.description,
      amount: r.amount,
      external_ref: r.external_ref,
      import_batch_id: importBatchId,
    })),
  );
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/accounting/bank/${bankAccountId}`);
  return { ok: true, imported: newRows.length, skipped };
}

export async function matchBankTransactionAction(
  clientId: string,
  bankAccountId: string,
  transactionId: string,
  journalLineId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase.rpc("match_bank_transaction", {
    p_transaction_id: transactionId,
    p_journal_line_id: journalLineId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/accounting/bank/${bankAccountId}`);
  return { ok: true };
}

export async function unmatchBankTransactionAction(
  clientId: string,
  bankAccountId: string,
  transactionId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase.rpc("unmatch_bank_transaction", {
    p_transaction_id: transactionId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/accounting/bank/${bankAccountId}`);
  return { ok: true };
}
