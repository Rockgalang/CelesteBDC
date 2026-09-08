import { redirect } from "next/navigation";

import { PermitsForm } from "@/app/(onboard)/onboard/permits/permits-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import type { JobType } from "@/lib/supabase/types";

const SEC_ENTITY_TYPES = new Set(["opc", "corporation", "partnership"]);

export default async function OnboardPermitsPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    redirect("/onboard");
  }

  const supabase = await createClient();
  const [{ data: client }, { data: jobs }, { data: documents }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("entity_type")
        .eq("id", profile.client_id)
        .single(),
      supabase
        .from("registration_jobs")
        .select("job_type, status")
        .eq("client_id", profile.client_id),
      supabase
        .from("documents")
        .select("id, category, filename")
        .eq("client_id", profile.client_id)
        .in("category", ["registration_certificate", "permit"]),
    ]);

  if (!client) redirect("/onboard");

  const nameRegistrationJobType: JobType = SEC_ENTITY_TYPES.has(
    client.entity_type,
  )
    ? "sec"
    : "dti";
  const nameRegistrationLabel = SEC_ENTITY_TYPES.has(client.entity_type)
    ? "SEC Registration"
    : "DTI Business Name Registration";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Business permits & registrations
        </h1>
        <p className="text-muted-foreground text-sm">
          For each one: upload it if you already have it, or tell us to
          register it for you.
        </p>
      </div>
      <PermitsForm
        items={[
          {
            jobType: nameRegistrationJobType,
            label: nameRegistrationLabel,
            category: "registration_certificate",
          },
          {
            jobType: "bir_registration",
            label: "BIR Registration (Certificate of Registration / Form 2303)",
            category: "registration_certificate",
          },
          {
            jobType: "lgu_mayors_permit",
            label: "Mayor's / Business Permit",
            category: "permit",
          },
        ]}
        existingJobs={jobs ?? []}
        existingDocuments={documents ?? []}
        clientId={profile.client_id}
      />
    </div>
  );
}
