"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { toDbString, money } from "@/lib/money";
import {
  manualLedgerEntrySchema,
  type ManualLedgerEntryInput,
} from "@/lib/validation/ledger";

/** Manual ledger entries are the client's own record (RLS lets
 * client_admin/client_user fully manage their own client's rows) — these
 * actions just validate input and give clean error messages. */
export async function addManualLedgerEntryAction(
  input: ManualLedgerEntryInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile.client_id) {
    return { ok: false, error: "No business linked to this account." };
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
    client_id: profile.client_id,
    entry_type: parsed.data.entryType,
    entry_date: parsed.data.entryDate,
    description: parsed.data.description,
    amount: toDbString(money(parsed.data.amount)),
    category: parsed.data.category || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/reports");
  return { ok: true };
}

export async function updateManualLedgerEntryAction(
  id: string,
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

  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteManualLedgerEntryAction(
  id: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_ledger_entries")
    .delete()
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/reports");
  return { ok: true };
}
