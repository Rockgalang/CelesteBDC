"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  closePeriodSchema,
  reopenPeriodSchema,
  type ClosePeriodInput,
  type ReopenPeriodInput,
} from "@/lib/validation/accounting";

export async function closePeriodAction(
  input: ClosePeriodInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = closePeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_accounting_period", {
    p_client_id: parsed.data.clientId,
    p_period: parsed.data.period,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/accounting/financials`);
  return { ok: true };
}

export async function reopenPeriodAction(
  input: ReopenPeriodInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = reopenPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_accounting_period", {
    p_client_id: parsed.data.clientId,
    p_period: parsed.data.period,
    p_reason: parsed.data.reason,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/accounting/financials`);
  return { ok: true };
}
