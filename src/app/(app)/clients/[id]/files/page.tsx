import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { JOB_TYPE_LABELS } from "@/lib/validation/registration";

export const metadata: Metadata = { title: "Client's files — Celeste.bdc" };

export default async function ClientRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("registration_jobs")
    .select("id, job_type, status, current_stage, target_date")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {jobs?.length ?? 0} registration job{jobs?.length === 1 ? "" : "s"}.
        </p>
        <Button asChild size="sm">
          <Link href={`/registrations/new?clientId=${id}`}>
            <PlusIcon className="size-4" />
            New registration
          </Link>
        </Button>
      </div>

      {jobs && jobs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Target date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} className="group">
                <TableCell>
                  <Link
                    href={`/registrations/${job.id}`}
                    className="group-hover:text-primary font-medium transition-colors"
                  >
                    {JOB_TYPE_LABELS[job.job_type]}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {job.current_stage ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {job.target_date ? formatManila(job.target_date) : "—"}
                </TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground text-sm">
          No registration jobs yet for this client.
        </p>
      )}
    </div>
  );
}
