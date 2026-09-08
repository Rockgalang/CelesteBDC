"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { money, toDbString, ZERO } from "@/lib/money";
import { queueNotificationToClientAdmins } from "@/lib/notifications/queue";
import { createClient } from "@/lib/supabase/server";
import {
  submitPaymentSchema,
  type SubmitPaymentInput,
} from "@/lib/validation/billing";

/** client_admin submits proof of payment. RLS (payments_insert_own_client_admin)
 * is the real authorization boundary here — this check just gives a clean
 * error message instead of a bare RLS rejection. The client no longer types
 * an amount, method, or reference: amount is the invoice's remaining
 * balance and method comes from the channel they say they paid to, both
 * derived server-side so a client can't misreport either. */
export async function submitPaymentAction(
  input: SubmitPaymentInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin") {
    return {
      ok: false,
      error: "Only a client admin can submit payment proof.",
    };
  }

  const parsed = submitPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();

  const [{ data: invoice }, { data: confirmedPayments }, { data: channel }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, total")
        .eq("id", parsed.data.invoiceId)
        .single(),
      supabase
        .from("payments")
        .select("amount")
        .eq("invoice_id", parsed.data.invoiceId)
        .eq("status", "confirmed"),
      supabase
        .from("payment_channels")
        .select("id, method, active")
        .eq("id", parsed.data.channelId)
        .single(),
    ]);

  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (!channel || !channel.active) {
    return { ok: false, error: "That payment channel is no longer available." };
  }

  const confirmedTotal = (confirmedPayments ?? []).reduce(
    (sum, p) => sum.plus(money(p.amount)),
    ZERO,
  );
  const remaining = money(invoice.total).minus(confirmedTotal);
  if (remaining.lte(0)) {
    return { ok: false, error: "This invoice is already fully paid." };
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: parsed.data.invoiceId,
    amount: toDbString(remaining),
    method: channel.method,
    channel_id: channel.id,
    proof_document_id: parsed.data.proofDocumentId,
    status: "submitted",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  return { ok: true };
}

export async function confirmPaymentAction(
  paymentId: string,
  invoiceId: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "owner" && profile.role !== "staff") {
    return { ok: false, error: "Only owner or staff can confirm a payment." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", {
    p_payment_id: paymentId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("number, client_id, clients(business_name)")
    .eq("id", invoiceId)
    .single();
  if (invoice) {
    const client = invoice.clients as unknown as {
      business_name: string;
    } | null;
    await queueNotificationToClientAdmins(supabase, {
      clientId: invoice.client_id,
      template: "payment_confirmed",
      payload: {
        business_name: client?.business_name ?? "",
        invoice_number: invoice.number ?? "",
      },
    });
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function rejectPaymentAction(
  paymentId: string,
  invoiceId: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "owner" && profile.role !== "staff") {
    return { ok: false, error: "Only owner or staff can reject a payment." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: paymentId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}
