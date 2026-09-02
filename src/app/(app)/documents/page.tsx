import type { Metadata } from "next";

import { DocumentsPanel } from "@/app/(app)/clients/[id]/documents-panel";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents — Celeste.bdc" };

export default async function PortalDocumentsPage() {
  const profile = await getCurrentProfile();

  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste BDC
        representative.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", profile.client_id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">
          Upload receipts, IDs, and other files. Cel and her team can see
          everything here too.
        </p>
      </div>
      <DocumentsPanel
        clientId={profile.client_id}
        documents={documents ?? []}
      />
    </div>
  );
}
