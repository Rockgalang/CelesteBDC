import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  ReceiptIcon,
  WorkflowIcon,
} from "lucide-react";

import { JobStatusBadge } from "@/app/(app)/registrations/job-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { JOB_TYPE_LABELS } from "@/lib/validation/registration";

export const metadata: Metadata = { title: "Client dashboard — Celeste.bdc" };

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [
    { data: client },
    { data: subscription },
    { data: openJobs },
    { data: unpaidInvoices },
    { data: pendingPayments },
    { data: receiptsQueue },
    { count: documentCount },
  ] = await Promise.all([
    supabase.from("clients").select("id, business_name").eq("id", id).single(),
    supabase
      .from("subscriptions")
      .select("cycle, current_period_end, plans(name, price_monthly)")
      .eq("client_id", id)
      .in("status", ["active", "grace", "suspended"])
      .maybeSingle(),
    supabase
      .from("registration_jobs")
      .select("id, job_type, status, current_stage")
      .eq("client_id", id)
      .in("status", ["not_started", "in_progress", "blocked"])
      .order("status", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, total")
      .eq("client_id", id)
      .in("status", ["issued", "partially_paid", "overdue"]),
    supabase
      .from("payments")
      .select("id, amount, invoice_id, invoices!inner(client_id)")
      .eq("invoices.client_id", id)
      .eq("status", "submitted"),
    supabase
      .from("receipts")
      .select("id")
      .eq("client_id", id)
      .in("status", ["uploaded", "processing", "needs_review", "ocr_failed"]),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id),
  ]);

  if (!client) notFound();

  const plan = subscription?.plans as unknown as {
    name: string;
    price_monthly: string;
  } | null;
  const unpaidTotal = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum.plus(money(inv.total)),
    ZERO,
  );
  const blockedJobs = (openJobs ?? []).filter((j) => j.status === "blocked");
  const receiptsCount = receiptsQueue?.length ?? 0;
  const paymentsCount = pendingPayments?.length ?? 0;

  type Task = {
    label: string;
    detail: string;
    href: string;
    urgent: boolean;
  };
  const tasks: Task[] = [];

  for (const job of blockedJobs) {
    tasks.push({
      label: `${JOB_TYPE_LABELS[job.job_type]} is blocked`,
      detail: job.current_stage ?? "Needs attention",
      href: `/registrations/${job.id}`,
      urgent: true,
    });
  }
  if (paymentsCount > 0) {
    tasks.push({
      label: `${paymentsCount} payment${paymentsCount === 1 ? "" : "s"} awaiting confirmation`,
      detail: "Proof of payment submitted, needs review",
      href: `/clients/${id}/invoices`,
      urgent: false,
    });
  }
  if (receiptsCount > 0) {
    tasks.push({
      label: `${receiptsCount} receipt${receiptsCount === 1 ? "" : "s"} to review`,
      detail: "Uploaded, awaiting OCR review and posting",
      href: `/receipts/review?clientId=${id}`,
      urgent: false,
    });
  }
  for (const job of (openJobs ?? []).filter((j) => j.status !== "blocked")) {
    tasks.push({
      label: JOB_TYPE_LABELS[job.job_type],
      detail: job.current_stage ?? "In progress",
      href: `/registrations/${job.id}`,
      urgent: false,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{plan?.name ?? "No active plan"}</p>
            {plan && (
              <p className="text-muted-foreground text-xs">
                {formatPeso(money(plan.price_monthly))}/mo
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Registrations open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{openJobs?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unpaid balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatPeso(unpaidTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents on file</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{documentCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle2Icon className="size-4 text-emerald-600" />
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="space-y-1">
              {tasks.map((task, i) => (
                <li key={i}>
                  <Link
                    href={task.href}
                    className="hover:bg-accent -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
                  >
                    {task.urgent ? (
                      <AlertTriangleIcon className="text-destructive size-4 shrink-0" />
                    ) : task.href.startsWith("/receipts") ? (
                      <CameraIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : task.href.includes("/invoices") ? (
                      <ReceiptIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <WorkflowIcon className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.label}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {task.detail}
                      </p>
                    </div>
                    {task.urgent && <Badge variant="destructive">Blocked</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {openJobs && openJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registration status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openJobs.map((job) => (
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
