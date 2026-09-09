import type { Metadata } from "next";

import { LetterheadEditor } from "@/app/(app)/settings/invoice-letterhead/letterhead-editor";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice letterhead — Celeste.bdc" };

export default async function InvoiceLetterheadPage() {
  await requireRole("owner");

  const supabase = await createClient();
  const { data: letterhead } = await supabase
    .from("invoice_letterhead")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invoice letterhead
        </h1>
        <p className="text-muted-foreground text-sm">
          Shown at the top of every invoice, for both Cel&apos;s team and
          clients.
        </p>
      </div>
      {letterhead && <LetterheadEditor letterhead={letterhead} />}
    </div>
  );
}
