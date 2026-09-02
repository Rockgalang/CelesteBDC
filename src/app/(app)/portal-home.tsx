import Link from "next/link";
import { FileTextIcon, ReceiptIcon, WorkflowIcon } from "lucide-react";

import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { JOB_TYPE_LABELS } from "@/lib/validation/registration";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/current-profile";

/**
 * Client portal home (build spec §7.10). Only shows what Phase 0/1
 * actually has data for — registration status, document count, unpaid
 * invoices. Next deadline (tax_obligations), receipt count against plan
 * limit (Phase 2), payslips (Phase 4), and the message thread with Cel
 * are not built yet; each is a distinct future addition, not a stub on
 * this page.
 */
export async function PortalHome({ profile }: { profile: CurrentProfile }) {
  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste BDC
        representative.
      </p>
    );
  }

  const supabase = await createClient();
  const [
    { data: client },
    { data: jobs },
    { data: documents },
    { data: unpaidInvoices },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("business_name, status")
      .eq("id", profile.client_id)
      .single(),
    supabase
      .from("registration_jobs")
      .select("id, job_type, status, current_stage")
      .eq("client_id", profile.client_id)
      .in("status", ["not_started", "in_progress", "blocked"]),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", profile.client_id),
    supabase
      .from("invoices")
      .select("id, number, total")
      .eq("client_id", profile.client_id)
      .in("status", ["issued", "partially_paid", "overdue"]),
  ]);

  const unpaidTotal = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum.plus(money(inv.total)),
    ZERO,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {client?.business_name ?? "Your business"}
        </h1>
        <Badge variant="secondary" className="mt-1 capitalize">
          {client?.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <WorkflowIcon className="text-muted-foreground size-4" />
            <CardTitle className="text-sm font-medium">
              Registrations in progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{jobs?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <FileTextIcon className="text-muted-foreground size-4" />
            <CardTitle className="text-sm font-medium">
              Documents on file
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{documents?.length ?? 0}</p>
          </CardContent>
        </Card>
        {profile.role === "client_admin" && (
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <ReceiptIcon className="text-muted-foreground size-4" />
              <CardTitle className="text-sm font-medium">
                Unpaid invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatPeso(unpaidTotal)}
              </p>
              {(unpaidInvoices?.length ?? 0) > 0 && (
                <Link
                  href="/invoices"
                  className="text-primary text-xs hover:underline"
                >
                  View invoices
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {jobs && jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registration status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium">{JOB_TYPE_LABELS[job.job_type]}</p>
                  {job.current_stage && (
                    <p className="text-muted-foreground text-xs">
                      {job.current_stage}
                    </p>
                  )}
                </div>
                <JobStatusBadge status={job.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
