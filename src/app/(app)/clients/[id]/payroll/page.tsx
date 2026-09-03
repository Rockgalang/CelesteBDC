import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmployeesPanel } from "@/app/(app)/clients/[id]/payroll/employees-panel";
import { RunsPanel } from "@/app/(app)/clients/[id]/payroll/runs-panel";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payroll — Celeste.bdc" };

export default async function ClientPayrollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: subscription }, { data: employees }, { data: runs }] =
    await Promise.all([
      supabase.from("clients").select("id, business_name").eq("id", id).single(),
      supabase
        .from("subscriptions")
        .select("plans(employee_limit, features)")
        .eq("client_id", id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("employees")
        .select("*")
        .eq("client_id", id)
        .order("full_name"),
      supabase
        .from("payroll_runs")
        .select("*")
        .eq("client_id", id)
        .order("period", { ascending: false }),
    ]);

  if (!client) notFound();

  const plan = subscription?.plans as unknown as {
    employee_limit: number | null;
    features: Record<string, unknown>;
  } | null;
  const payrollLocked = plan?.features?.payroll_locked === true;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Payroll — {client.business_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Employee roster, monthly payroll runs, and payslips.
        </p>
      </div>

      {payrollLocked && (
        <Card className="border-warning">
          <CardContent className="pt-4 text-sm">
            Payroll isn&apos;t included on this client&apos;s current plan
            (locked on Start Up). Payroll runs can still be recorded here,
            but consider upgrading the client&apos;s plan first.
          </CardContent>
        </Card>
      )}

      <EmployeesPanel
        clientId={id}
        employees={employees ?? []}
        employeeLimit={plan?.employee_limit ?? null}
      />
      <RunsPanel clientId={id} runs={runs ?? []} />
    </div>
  );
}
