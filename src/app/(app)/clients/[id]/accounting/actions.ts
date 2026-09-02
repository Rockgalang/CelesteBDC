"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createAccountSchema,
  type CreateAccountInput,
} from "@/lib/validation/accounting";

export async function seedChartOfAccountsAction(
  clientId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_default_chart_of_accounts", {
    p_client_id: clientId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/accounting`);
  return { ok: true };
}

export async function createAccountAction(
  input: CreateAccountInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("chart_of_accounts").insert({
    client_id: parsed.data.clientId,
    code: parsed.data.code,
    name: parsed.data.name,
    type: parsed.data.type,
    normal_balance: parsed.data.normalBalance,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/accounting`);
  return { ok: true };
}

export async function setAccountActiveAction(
  clientId: string,
  accountId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("chart_of_accounts")
    .update({ active })
    .eq("id", accountId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/accounting`);
  return { ok: true };
}
