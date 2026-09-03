import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PayslipRow } from "@/app/(app)/clients/[id]/payroll/[runId]/payslip-row";
import { ProcessPanel } from "@/app/(app)/clients/[id]/payroll/[runId]/process-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-profile";
import { formatManila, formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payroll run — Celeste.bdc" };

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  await requireRole("owner", "staff");
  const { id, runId } = await params;

  const supabase = await createClient();
  const [{ data: run }, { data: payslips }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("payroll_runs")
        .select("*, clients(business_name)")
        .eq("id", runId)
        .single(),
      supabase
        .from("payslips")
        .select("*, employees(full_name)")
        .eq("payroll_run_id", runId)
        .order("created_at"),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("client_id", id)
        .eq("active", true)
        .order("code"),
    ]);

  if (!run) notFound();

  const client = run.clients as unknown as { business_name: string } | null;
  const editable = run.status === "draft";
  const totalNet = (payslips ?? []).reduce(
    (sum, p) => sum.plus(money(p.net_pay)),
    ZERO,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">{client?.business_name}</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Payroll — {run.period}
          </h1>
          <Badge variant={run.status === "processed" ? "success" : "secondary"}>
            {run.status}
          </Badge>
        </div>
        {run.pay_date && (
          <p className="text-muted-foreground text-sm">
            Pay date {formatManila(run.pay_date)}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Payslips
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              Total net {formatPeso(totalNet)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(payslips ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No payslips on this run.
            </p>
          ) : (
            (payslips ?? []).map((p) => {
              const employee = p.employees as unknown as {
                full_name: string;
              } | null;
              return (
                <PayslipRow
                  key={p.id}
                  clientId={id}
                  runId={runId}
                  payslip={p}
                  employeeName={employee?.full_name ?? "—"}
                  editable={editable}
                />
              );
            })
          )}
        </CardContent>
      </Card>

      {editable ? (
        <ProcessPanel runId={runId} accounts={accounts ?? []} />
      ) : (
        <p className="text-muted-foreground text-sm">
          This run is processed and locked. Its journal entry has been
          posted to the books.
        </p>
      )}
    </div>
  );
}
