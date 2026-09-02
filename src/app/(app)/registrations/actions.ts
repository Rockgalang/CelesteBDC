"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createJobSchema,
  governmentFeeSchema,
  type CreateJobInput,
  type GovernmentFeeInput,
} from "@/lib/validation/registration";

export async function createJobAction(
  input: CreateJobInput,
): Promise<ActionResult & { id?: string }> {
  await requireRole("owner", "staff");

  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_registration_job", {
    p_client_id: parsed.data.clientId,
    p_job_type: parsed.data.jobType,
    p_is_renewal: parsed.data.isRenewal,
    p_target_date: parsed.data.targetDate || null,
    p_notes: parsed.data.notes || null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create job." };
  }

  revalidatePath("/registrations");
  return { ok: true, id: data.id };
}

export async function advanceJobStageAction(
  jobId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_registration_job_stage", {
    p_job_id: jobId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/registrations");
  revalidatePath(`/registrations/${jobId}`);
  return { ok: true };
}

export async function toggleChecklistItemAction(
  itemId: string,
  jobId: string,
  satisfied: boolean,
  documentId?: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_checklist_items")
    .update({
      satisfied_at: satisfied ? new Date().toISOString() : null,
      satisfied_by_document_id: satisfied ? (documentId ?? null) : null,
    })
    .eq("id", itemId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/registrations/${jobId}`);
  return { ok: true };
}

export async function addGovernmentFeeAction(
  input: GovernmentFeeInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = governmentFeeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("government_fees").insert({
    job_id: parsed.data.jobId,
    agency: parsed.data.agency,
    description: parsed.data.description,
    amount_at_cost: parsed.data.amountAtCost.toFixed(2),
    handling_fee: parsed.data.handlingFee.toFixed(2),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/registrations/${parsed.data.jobId}`);
  return { ok: true };
}
