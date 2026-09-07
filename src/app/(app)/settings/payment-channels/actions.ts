"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  paymentChannelSchema,
  type PaymentChannelInput,
} from "@/lib/validation/self-registration";

export async function createPaymentChannelAction(
  input: PaymentChannelInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = paymentChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payment_channels").insert({
    label: parsed.data.label,
    method: parsed.data.method,
    account_name: parsed.data.accountName || null,
    account_number: parsed.data.accountNumber || null,
    instructions: parsed.data.instructions || null,
    qr_image_data_url: parsed.data.qrImageDataUrl || null,
    active: parsed.data.active,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/payment-channels");
  return { ok: true };
}

export async function updatePaymentChannelAction(
  id: string,
  input: PaymentChannelInput,
): Promise<ActionResult> {
  await requireRole("owner");

  const parsed = paymentChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_channels")
    .update({
      label: parsed.data.label,
      method: parsed.data.method,
      account_name: parsed.data.accountName || null,
      account_number: parsed.data.accountNumber || null,
      instructions: parsed.data.instructions || null,
      qr_image_data_url: parsed.data.qrImageDataUrl || null,
      active: parsed.data.active,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/payment-channels");
  return { ok: true };
}
