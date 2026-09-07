import type { Metadata } from "next";

import { PaymentChannelEditor } from "@/app/(app)/settings/payment-channels/payment-channel-editor";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment channels — Celeste.bdc" };

export default async function PaymentChannelsPage() {
  await requireRole("owner");

  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("payment_channels")
    .select("*")
    .order("created_at");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment channels
        </h1>
        <p className="text-muted-foreground text-sm">
          What clients see when paying an invoice, including during
          self-registration. Enter your real GCash account and upload a
          photo of your real GCash QR — never placeholder details, since
          clients pay against this directly.
        </p>
      </div>
      <div className="space-y-4">
        {(channels ?? []).map((c) => (
          <PaymentChannelEditor key={c.id} channel={c} />
        ))}
        <PaymentChannelEditor channel={null} />
      </div>
    </div>
  );
}
