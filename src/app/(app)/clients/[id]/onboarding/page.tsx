import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ActivatePanel } from "@/app/(app)/clients/[id]/onboarding/activate-panel";
import { EngagementLetterPanel } from "@/app/(app)/clients/[id]/onboarding/engagement-letter-panel";
import { PlanPanel } from "@/app/(app)/clients/[id]/onboarding/plan-panel";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Onboarding — Celeste.bdc" };

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: client },
    { data: plans },
    { data: subscription },
    { data: letter },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_name, status")
      .eq("id", id)
      .single(),
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Onboard {client.business_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Intake is done — this client already exists in the registry. Plan
          selection → agreement → document collection → activation.
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
  );
}
