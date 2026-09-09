"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { toDbString, money } from "@/lib/money";
import {
  createExtraRegistrationRequestSchema,
  declineExtraRegistrationRequestSchema,
  quoteExtraRegistrationRequestSchema,
  type CreateExtraRegistrationRequestInput,
  type DeclineExtraRegistrationRequestInput,
  type QuoteExtraRegistrationRequestInput,
} from "@/lib/validation/extra-registrations";

function revalidateExtraRequestPaths(clientId: string) {
  revalidatePath("/documents");
  revalidatePath(`/clients/${clientId}/files`);
}

export async function createExtraRegistrationRequestAction(
  input: CreateExtraRegistrationRequestInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!isInternalRole(profile.role) && profile.client_id !== input.clientId) {
    return { ok: false, error: "You can only request this for your own business." };
  }

  const parsed = createExtraRegistrationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("extra_registration_requests").insert({
    client_id: parsed.data.clientId,
    label: parsed.data.label,
    note: parsed.data.note || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateExtraRequestPaths(parsed.data.clientId);
  return { ok: true };
}

export async function quoteExtraRegistrationRequestAction(
  clientId: string,
  input: QuoteExtraRegistrationRequestInput,
): Promise<ActionResult> {
  const parsed = quoteExtraRegistrationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("quote_extra_registration_request", {
    p_id: parsed.data.requestId,
    p_fee: Number(toDbString(money(parsed.data.fee))),
    p_note: parsed.data.note || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateExtraRequestPaths(clientId);
  return { ok: true };
}

export async function declineExtraRegistrationRequestAction(
  clientId: string,
  input: DeclineExtraRegistrationRequestInput,
): Promise<ActionResult> {
  const parsed = declineExtraRegistrationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_extra_registration_request", {
    p_id: parsed.data.requestId,
    p_note: parsed.data.note || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateExtraRequestPaths(clientId);
  return { ok: true };
}

export async function respondExtraRegistrationRequestAction(
  clientId: string,
  requestId: string,
  accept: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_extra_registration_request", {
    p_id: requestId,
    p_accept: accept,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateExtraRequestPaths(clientId);
  return { ok: true };
}
