import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClientForm } from "@/app/(app)/clients/client-form";
import { ContactsPanel } from "@/app/(app)/clients/[id]/contacts-panel";
import { DocumentsPanel } from "@/app/(app)/clients/[id]/documents-panel";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client — Celeste.bdc" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: contacts }, { data: documents }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", id)
        .order("is_primary", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.business_name}
          </h1>
          {client.trade_name && (
            <p className="text-muted-foreground text-sm">{client.trade_name}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${client.id}/onboarding`}>Onboarding</Link>
        </Button>
      </div>

      <ClientForm
        clientId={client.id}
        defaultValues={{
          businessName: client.business_name,
          tradeName: client.trade_name ?? undefined,
          entityType: client.entity_type,
          taxType: client.tax_type,
          fiscalYearEndMonth: client.fiscal_year_end_month,
          vatRegistered: client.vat_registered,
          tin: client.tin ?? undefined,
          rdoCode: client.rdo_code ?? undefined,
          dtiRegNo: client.dti_reg_no ?? undefined,
          secRegNo: client.sec_reg_no ?? undefined,
          mayorsPermitNo: client.mayors_permit_no ?? undefined,
          addressLine: client.address_line ?? undefined,
          barangay: client.barangay ?? undefined,
          city: client.city ?? undefined,
          province: client.province ?? undefined,
          postalCode: client.postal_code ?? undefined,
          status: client.status,
        }}
      />

      <ContactsPanel clientId={client.id} contacts={contacts ?? []} />
      <DocumentsPanel clientId={client.id} documents={documents ?? []} />
    </div>
  );
}
