import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChecklistPanel } from "@/app/(app)/registrations/[id]/checklist-panel";
import { FeesPanel } from "@/app/(app)/registrations/[id]/fees-panel";
import { StagesTimeline } from "@/app/(app)/registrations/[id]/stages-timeline";
import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-profile";
import { formatManila } from "@/lib/format";
import { JOB_TYPE_LABELS } from "@/lib/validation/registration";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registration job — Celeste.bdc" };

export default async function RegistrationJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: job }, { data: stages }, { data: checklist }, { data: fees }] =
    await Promise.all([
      supabase
        .from("registration_jobs")
        .select("*, clients(id, business_name)")
        .eq("id", id)
        .single(),
      supabase
        .from("job_stages")
        .select("*")
        .eq("job_id", id)
        .order("sequence"),
      supabase.from("job_checklist_items").select("*").eq("job_id", id),
      supabase
        .from("government_fees")
        .select("*")
        .eq("job_id", id)
        .order("created_at"),
    ]);

  if (!job) notFound();

  const client = job.clients as unknown as {
    id: string;
    business_name: string;
  } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">{client?.business_name}</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {JOB_TYPE_LABELS[job.job_type]}
            {job.is_renewal && " (Renewal)"}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        {job.target_date && (
          <p className="text-muted-foreground text-sm">
            Target date: {formatManila(job.target_date)}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <StagesTimeline
            jobId={job.id}
            stages={stages ?? []}
            jobStatus={job.status}
          />
        </CardContent>
      </Card>

      <ChecklistPanel jobId={job.id} items={checklist ?? []} />
      <FeesPanel jobId={job.id} fees={fees ?? []} />
    </div>
  );
}
