import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClientForm } from "@/app/(app)/clients/client-form";
import { ContactsPanel } from "@/app/(app)/clients/[id]/contacts-panel";
import { ActivatePanel } from "@/app/(app)/clients/[id]/onboarding/activate-panel";
import { EngagementLetterPanel } from "@/app/(app)/clients/[id]/onboarding/engagement-letter-panel";
import { PlanPanel } from "@/app/(app)/clients/[id]/onboarding/plan-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client profile — Celeste.bdc" };

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: client },
    { data: contacts },
    { data: plans },
    { data: subscription },
    { data: letter },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", id)
      .order("is_primary", { ascending: false }),
    supabase.from("plans").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("client_id", id)
      .in("status", ["active", "grace", "suspended"])
      .maybeSingle(),
    supabase
      .from("engagement_letters")
      .select("*")
      .eq("client_id", id)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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

      <div className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Onboarding</h2>
          <p className="text-muted-foreground text-sm">
            Plan selection → agreement → activation. Only relevant while this
            client is being brought on — once active, these stay here for
            reference.
          </p>
        </div>
        <PlanPanel
          clientId={client.id}
          plans={plans ?? []}
          subscription={subscription ?? null}
        />
        <EngagementLetterPanel
          clientId={client.id}
          existingLetter={letter ?? null}
          disabled={!subscription}
        />
        <ActivatePanel
          clientId={client.id}
          disabled={!subscription || !letter}
          alreadyActive={client.status === "active"}
        />
      </div>
    </div>
  );
}
