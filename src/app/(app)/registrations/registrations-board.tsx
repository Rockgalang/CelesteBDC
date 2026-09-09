"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { updateJobStatusAction } from "@/app/(app)/registrations/actions";
import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "@/lib/format";
import { JOB_TYPE_LABELS } from "@/lib/validation/registration";
import type { JobStatus } from "@/lib/supabase/types";

export type BoardJob = {
  id: string;
  client_id: string;
  job_type: keyof typeof JOB_TYPE_LABELS;
  status: JobStatus;
  current_stage: string | null;
  target_date: string | null;
  business_name: string;
};

const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "not_started", label: "Not started" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "completed", label: "Completed" },
];

export function RegistrationsBoard({ jobs }: { jobs: BoardJob[] }) {
  const router = useRouter();
  const [localJobs, setLocalJobs] = useState(jobs);
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const didDragRef = useRef(false);

  const byStatus = COLUMNS.map((col) => ({
    ...col,
    jobs: localJobs.filter((j) => j.status === col.status),
  }));

  const onDrop = (status: JobStatus) => {
    setDragOverStatus(null);
    const jobId = dragJobId;
    setDragJobId(null);
    if (!jobId) return;

    const job = localJobs.find((j) => j.id === jobId);
    if (!job || job.status === status) return;

    setError(null);
    const previousStatus = job.status;
    setLocalJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j)),
    );

    startTransition(async () => {
      const result = await updateJobStatusAction(jobId, status);
      if (!result.ok) {
        setError(result.error);
        setLocalJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: previousStatus } : j)),
        );
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-4">
        {byStatus.map((col) => (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(col.status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(col.status);
            }}
            className={`space-y-3 rounded-lg p-2 transition-colors ${
              dragOverStatus === col.status ? "bg-accent" : ""
            }`}
          >
            <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              {col.label}
              <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {col.jobs.length}
              </span>
            </h2>
            <div className="space-y-3">
              {col.jobs.map((job) => (
                <Card
                  key={job.id}
                  draggable
                  onDragStart={() => {
                    didDragRef.current = false;
                    setDragJobId(job.id);
                  }}
                  onDrag={() => {
                    didDragRef.current = true;
                  }}
                  onDragEnd={() => setDragJobId(null)}
                  onClick={() => {
                    if (didDragRef.current) return;
                    router.push(`/clients/${job.client_id}/files`);
                  }}
                  className={`hover:border-primary/50 gap-2 py-4 transition-colors ${
                    isPending && dragJobId === job.id ? "opacity-50" : ""
                  } cursor-grab active:cursor-grabbing`}
                >
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm">{job.business_name}</CardTitle>
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
