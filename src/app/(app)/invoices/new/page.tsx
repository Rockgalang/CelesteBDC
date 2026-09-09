import type { Metadata } from "next";

import { NewInvoiceForm } from "@/app/(app)/invoices/new/new-invoice-form";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New charge — Celeste.bdc" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requireRole("owner", "staff");
  const { clientId } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name")
    .order("business_name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New extra charge
        </h1>
        <p className="text-muted-foreground text-sm">
          For anything outside the client&apos;s subscription package —
          extra registrations, government fees, one-off work. Starts as a
          draft; you&apos;ll need to attach the client&apos;s proof of
          payment before it can be issued.
        </p>
      </div>
      <NewInvoiceForm clients={clients ?? []} defaultClientId={clientId} />
    </div>
  );
}
