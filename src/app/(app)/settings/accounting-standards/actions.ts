"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createTemplateAccountSchema,
  duplicateTemplateSetSchema,
  renameTemplateSetSchema,
  setTemplateSetDefaultsSchema,
  updateTemplateAccountSchema,
  type CreateTemplateAccountInput,
  type DuplicateTemplateSetInput,
  type RenameTemplateSetInput,
  type SetTemplateSetDefaultsInput,
  type UpdateTemplateAccountInput,
} from "@/lib/validation/accounting-standards";

const PATH = "/settings/accounting-standards";

export async function duplicateTemplateSetAction(
  input: DuplicateTemplateSetInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = duplicateTemplateSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("duplicate_chart_of_account_template_set", {
    p_set_id: parsed.data.setId,
    p_name: parsed.data.name,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function renameTemplateSetAction(
  input: RenameTemplateSetInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = renameTemplateSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("chart_of_account_template_sets")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", parsed.data.setId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateSetAction(setId: string): Promise<ActionResult> {
  await requireRole("owner");

  const supabase = await createClient();
  const { error } = await supabase
    .from("chart_of_account_template_sets")
    .delete()
    .eq("id", setId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function setTemplateSetDefaultsAction(
  input: SetTemplateSetDefaultsInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = setTemplateSetDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_chart_of_account_template_set_defaults", {
    p_set_id: parsed.data.setId,
    p_entity_types: parsed.data.entityTypes,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function createTemplateAccountAction(
  input: CreateTemplateAccountInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = createTemplateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("chart_of_account_templates").insert({
    template_set_id: parsed.data.templateSetId,
    code: parsed.data.code,
    name: parsed.data.name,
    type: parsed.data.type,
    normal_balance: parsed.data.normalBalance,
    parent_code: parsed.data.parentCode || null,
    sequence: parsed.data.sequence,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateTemplateAccountAction(
  input: UpdateTemplateAccountInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = updateTemplateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("chart_of_account_templates")
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      normal_balance: parsed.data.normalBalance,
      parent_code: parsed.data.parentCode || null,
      sequence: parsed.data.sequence,
    })
    .eq("id", parsed.data.templateId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteTemplateAccountAction(
  templateId: string,
): Promise<ActionResult> {
  await requireRole("owner");

  const supabase = await createClient();
  const { error } = await supabase
    .from("chart_of_account_templates")
    .delete()
    .eq("id", templateId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true };
}
