import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { RegistrationsBoard, type BoardJob } from "@/app/(app)/registrations/registrations-board";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/current-profile";
import { JOB_TYPE_LABELS, JOB_TYPES } from "@/lib/validation/registration";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registrations — Celeste.bdc" };

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobType?: string }>;
}) {
  await requireRole("owner", "staff");
  const { jobType } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("registration_jobs")
    .select(
      "id, client_id, job_type, status, current_stage, target_date, clients(business_name)",
    )
    .neq("status", "cancelled")
    .order("target_date", { ascending: true, nullsFirst: false });

  if (jobType && (JOB_TYPES as readonly string[]).includes(jobType)) {
    query = query.eq("job_type", jobType as (typeof JOB_TYPES)[number]);
  }

  const { data: jobs } = await query;

  const boardJobs: BoardJob[] = (jobs ?? []).map((j) => ({
    id: j.id,
    client_id: j.client_id,
    job_type: j.job_type,
    status: j.status,
    current_stage: j.current_stage,
    target_date: j.target_date,
    business_name:
      (j.clients as unknown as { business_name: string } | null)?.business_name ??
      "—",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registration pipeline
          </h1>
          <p className="text-muted-foreground text-sm">
            Drag a card to a new status. Each card&apos;s current stage is
            shown below its job type — stage names differ per job type, so
            stages aren&apos;t the board&apos;s columns. Click a card to open
            that client&apos;s Files &gt; Registration status.
          </p>
        </div>
        <Button asChild>
          <Link href="/registrations/new">
            <PlusIcon />
            New job
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/registrations">
          <Button variant={!jobType ? "default" : "outline"} size="sm">
            All types
          </Button>
        </Link>
        {JOB_TYPES.map((t) => (
          <Link key={t} href={`/registrations?jobType=${t}`}>
            <Button variant={jobType === t ? "default" : "outline"} size="sm">
              {JOB_TYPE_LABELS[t]}
            </Button>
          </Link>
        ))}
      </div>

      <RegistrationsBoard jobs={boardJobs} />
    </div>
  );
}
