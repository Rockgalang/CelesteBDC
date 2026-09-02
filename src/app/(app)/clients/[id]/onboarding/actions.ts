"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  selectPlanSchema,
  signEngagementLetterSchema,
  type SelectPlanInput,
  type SignEngagementLetterInput,
} from "@/lib/validation/onboarding";

export async function selectPlanAction(
  input: SelectPlanInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = selectPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("price_monthly, price_annual_monthly")
    .eq("id", parsed.data.planId)
    .single();
  if (planError || !plan) {
    return { ok: false, error: "Plan not found." };
  }

  const today = new Date();
  const periodEnd = new Date(today);
  const isAnnual = parsed.data.cycle === "annual";
  if (isAnnual) periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);

  // Annual subscribers get a 12-month price lock (build spec §5.2).
  const priceLockedUntil = isAnnual ? new Date(today) : null;
  if (priceLockedUntil)
    priceLockedUntil.setFullYear(priceLockedUntil.getFullYear() + 1);

  const { error } = await supabase.from("subscriptions").insert({
    client_id: parsed.data.clientId,
    plan_id: parsed.data.planId,
    cycle: parsed.data.cycle,
    current_period_end: periodEnd.toISOString().slice(0, 10),
    price_locked_until: priceLockedUntil?.toISOString().slice(0, 10) ?? null,
    locked_price: isAnnual ? plan.price_annual_monthly : null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/onboarding`);
  return { ok: true };
}

export async function signEngagementLetterAction(
  input: SignEngagementLetterInput,
): Promise<ActionResult> {
  const profile = await requireRole("owner", "staff", "client_admin");

  const parsed = signEngagementLetterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    null;
  const userAgent = headerList.get("user-agent");

  const supabase = await createClient();
  const { error } = await supabase.from("engagement_letters").insert({
    client_id: parsed.data.clientId,
    signed_by_name: parsed.data.signedByName,
    signed_by_profile_id: profile.id,
    ip,
    user_agent: userAgent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/onboarding`);
  return { ok: true };
}

export async function activateClientAction(
  clientId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "active", onboarded_at: new Date().toISOString() })
    .eq("id", clientId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/onboarding`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}
