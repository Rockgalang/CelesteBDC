import type { Metadata } from "next";

import { ReceiptsPanel } from "@/app/(app)/receipts/receipts-panel";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipts — Celeste.bdc" };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function PortalReceiptsPage() {
  const profile = await getCurrentProfile();

  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste
        BDC representative.
      </p>
    );
  }

  const supabase = await createClient();
  const period = currentMonth();
  const [{ data: receipts }, { data: subscription }, { data: usedCount }] =
    await Promise.all([
      supabase
        .from("receipts")
        .select("*")
        .eq("client_id", profile.client_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("plans(txn_limit)")
        .eq("client_id", profile.client_id)
        .eq("status", "active")
        .maybeSingle(),
      supabase.rpc("count_receipts_for_period", {
        p_client_id: profile.client_id,
        p_period: period,
      }),
    ]);

  const txnLimit =
    (subscription?.plans as unknown as { txn_limit: number | null } | null)
      ?.txn_limit ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
          <p className="text-muted-foreground text-sm">
            Photograph and upload receipts as you spend. Cel&apos;s team
            reviews and posts them to your books.
          </p>
        </div>
        {subscription && (
          <Badge variant={txnLimit && (usedCount ?? 0) >= txnLimit ? "warning" : "secondary"}>
            {usedCount ?? 0}
            {txnLimit ? ` / ${txnLimit}` : ""} this month
          </Badge>
        )}
      </div>
      <ReceiptsPanel clientId={profile.client_id} receipts={receipts ?? []} />
    </div>
  );
}
