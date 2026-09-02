"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  clientContactSchema,
  clientSchema,
  type ClientContactInput,
  type ClientInput,
} from "@/lib/validation/clients";

export async function createClientAction(
  input: ClientInput,
): Promise<ActionResult & { id?: string }> {
  await requireRole("owner", "staff");

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      business_name: parsed.data.businessName,
      trade_name: parsed.data.tradeName ?? null,
      entity_type: parsed.data.entityType,
      tax_type: parsed.data.taxType,
      fiscal_year_end_month: parsed.data.fiscalYearEndMonth,
      vat_registered: parsed.data.vatRegistered,
      tin: parsed.data.tin ?? null,
      rdo_code: parsed.data.rdoCode ?? null,
      dti_reg_no: parsed.data.dtiRegNo ?? null,
      sec_reg_no: parsed.data.secRegNo ?? null,
      mayors_permit_no: parsed.data.mayorsPermitNo ?? null,
      address_line: parsed.data.addressLine ?? null,
      barangay: parsed.data.barangay ?? null,
      city: parsed.data.city ?? null,
      province: parsed.data.province ?? null,
      postal_code: parsed.data.postalCode ?? null,
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create client." };
  }

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  clientId: string,
  input: ClientInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      business_name: parsed.data.businessName,
      trade_name: parsed.data.tradeName ?? null,
      entity_type: parsed.data.entityType,
      tax_type: parsed.data.taxType,
      fiscal_year_end_month: parsed.data.fiscalYearEndMonth,
      vat_registered: parsed.data.vatRegistered,
      tin: parsed.data.tin ?? null,
      rdo_code: parsed.data.rdoCode ?? null,
      dti_reg_no: parsed.data.dtiRegNo ?? null,
      sec_reg_no: parsed.data.secRegNo ?? null,
      mayors_permit_no: parsed.data.mayorsPermitNo ?? null,
      address_line: parsed.data.addressLine ?? null,
      barangay: parsed.data.barangay ?? null,
      city: parsed.data.city ?? null,
      province: parsed.data.province ?? null,
      postal_code: parsed.data.postalCode ?? null,
      status: parsed.data.status,
    })
    .eq("id", clientId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function createContactAction(
  input: ClientContactInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = clientContactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("client_contacts").insert({
    client_id: parsed.data.clientId,
    name: parsed.data.name,
    role: parsed.data.role ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    is_primary: parsed.data.isPrimary,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true };
}
