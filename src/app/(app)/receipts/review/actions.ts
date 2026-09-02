"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { money, toDbString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  approveReceiptSchema,
  rejectReceiptSchema,
  updateReceiptFieldsSchema,
  type ApproveReceiptInput,
  type RejectReceiptInput,
  type UpdateReceiptFieldsInput,
} from "@/lib/validation/accounting";

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
    p_debit_account_id: parsed.data.debitAccountId,
    p_credit_account_id: parsed.data.creditAccountId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/receipts/review");
  redirect("/receipts/review");
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
  redirect("/receipts/review");
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
  redirect("/receipts/review");
}
