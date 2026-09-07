"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  businessDetailsSchema,
  intakeQuestionnaireSchema,
  registerBusinessSchema,
  type BusinessDetailsInput,
  type IntakeQuestionnaireInput,
  type RegisterBusinessInput,
} from "@/lib/validation/self-registration";

export async function registerBusinessAction(
  input: RegisterBusinessInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_user" || profile.client_id) {
    return { ok: false, error: "This account is already linked to a business." };
  }

  const parsed = registerBusinessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("self_register_business", {
    p_business_name: parsed.data.businessName,
    p_entity_type: parsed.data.entityType,
    p_tax_type: parsed.data.taxType,
    p_plan_code: parsed.data.planCode,
    p_cycle: parsed.data.cycle,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/onboard/payment");
}

export async function updateBusinessDetailsAction(
  input: BusinessDetailsInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    return { ok: false, error: "Only a client admin can edit business details." };
  }

  const parsed = businessDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("clients")
    .select("intake_responses")
    .eq("id", profile.client_id)
    .single();

  const { error } = await supabase
    .from("clients")
    .update({
      trade_name: parsed.data.tradeName || null,
      tin: parsed.data.tin || null,
      rdo_code: parsed.data.rdoCode || null,
      fiscal_year_end_month: parsed.data.fiscalYearEndMonth,
      vat_registered: parsed.data.vatRegistered,
      dti_reg_no: parsed.data.dtiRegNo || null,
      sec_reg_no: parsed.data.secRegNo || null,
      mayors_permit_no: parsed.data.mayorsPermitNo || null,
      address_line: parsed.data.addressLine || null,
      barangay: parsed.data.barangay || null,
      city: parsed.data.city || null,
      province: parsed.data.province || null,
      postal_code: parsed.data.postalCode || null,
      intake_responses: {
        ...(current?.intake_responses ?? {}),
        _business_details_completed_at: new Date().toISOString(),
      },
    })
    .eq("id", profile.client_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboard/business");
  revalidatePath("/dashboard");
  redirect("/onboard/questionnaire");
}

export async function saveIntakeQuestionnaireAction(
  input: IntakeQuestionnaireInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    return { ok: false, error: "Only a client admin can answer the questionnaire." };
  }

  const parsed = intakeQuestionnaireSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("clients")
    .select("intake_responses")
    .eq("id", profile.client_id)
    .single();

  const { error } = await supabase
    .from("clients")
    .update({
      intake_responses: {
        ...(current?.intake_responses ?? {}),
        ...parsed.data,
        _questionnaire_completed_at: new Date().toISOString(),
      },
    })
    .eq("id", profile.client_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/onboard/questionnaire");
  revalidatePath("/dashboard");
  redirect("/dashboard?onboarded=1");
}
