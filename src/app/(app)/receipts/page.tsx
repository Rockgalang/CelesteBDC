import type { Metadata } from "next";

import { ReceiptsPanel } from "@/app/(app)/receipts/receipts-panel";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipts — Celeste.bdc" };

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
  const { data: receipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("client_id", profile.client_id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-muted-foreground text-sm">
          Photograph and upload receipts as you spend. Cel&apos;s team
          reviews and posts them to your books.
        </p>
      </div>
      <ReceiptsPanel clientId={profile.client_id} receipts={receipts ?? []} />
    </div>
  );
}
