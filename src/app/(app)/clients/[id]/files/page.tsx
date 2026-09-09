import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { DocumentsPanel } from "@/app/(app)/clients/[id]/documents-panel";
import { ExtraRegistrationRequestsPanel } from "@/app/(app)/clients/[id]/files/extra-registration-requests-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ClientFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: jobs }, { data: documents }, { data: extraRequests }] =
    await Promise.all([
      supabase
        .from("registration_jobs")
        .select("id, job_type, status, current_stage, target_date")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("extra_registration_requests")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Registration status</CardTitle>
          <Button asChild size="sm">
            <Link href={`/registrations/new?clientId=${id}`}>
              <PlusIcon className="size-4" />
              New registration
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <DocumentsPanel clientId={id} documents={documents ?? []} />

      <ExtraRegistrationRequestsPanel
        clientId={id}
        canManage={true}
        requests={extraRequests ?? []}
      />
    </div>
  );
}
