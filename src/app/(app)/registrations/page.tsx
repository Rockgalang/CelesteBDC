import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-profile";
import { formatManila } from "@/lib/format";
import { JOB_TYPE_LABELS, JOB_TYPES } from "@/lib/validation/registration";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Registrations — Celeste.bdc" };

const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "not_started", label: "Not started" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "completed", label: "Completed" },
];

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
      "id, job_type, status, current_stage, target_date, clients(business_name)",
    )
    .neq("status", "cancelled")
    .order("target_date", { ascending: true, nullsFirst: false });

  if (jobType && (JOB_TYPES as readonly string[]).includes(jobType)) {
    query = query.eq("job_type", jobType as (typeof JOB_TYPES)[number]);
  }

  const { data: jobs } = await query;

  const byStatus = COLUMNS.map((col) => ({
    ...col,
    jobs: (jobs ?? []).filter((j) => j.status === col.status),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Registration pipeline
          </h1>
          <p className="text-muted-foreground text-sm">
            Kanban by status. Each card&apos;s current stage is shown below its
            job type — stage names differ per job type, so stages aren&apos;t
            the board&apos;s columns.
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

      <div className="grid gap-4 lg:grid-cols-4">
        {byStatus.map((col) => (
          <div key={col.status} className="space-y-3">
            <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              {col.label}
              <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {col.jobs.length}
              </span>
            </h2>
            <div className="space-y-3">
              {col.jobs.map((job) => (
                <Link key={job.id} href={`/registrations/${job.id}`}>
                  <Card className="hover:border-primary/50 gap-2 py-4 transition-colors">
                    <CardHeader className="px-4">
                      <CardTitle className="text-sm">
                        {(
                          job.clients as unknown as {
                            business_name: string;
                          } | null
                        )?.business_name ?? "—"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-4">
                      <p className="text-muted-foreground text-xs">
                        {JOB_TYPE_LABELS[job.job_type]}
                      </p>
                      {job.current_stage && (
                        <p className="text-xs">{job.current_stage}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <JobStatusBadge status={job.status} />
                        {job.target_date && (
                          <span className="text-muted-foreground text-xs">
                            {formatManila(job.target_date)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {col.jobs.length === 0 && (
                <p className="text-muted-foreground text-xs">Nothing here.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
