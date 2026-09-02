import Link from "next/link";
import type { Metadata } from "next";
import { UsersRoundIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payroll — Celeste.bdc" };

/**
 * Payroll (build spec Phase 4) is not built yet — it needs its own data
 * model (employees, pay periods, government-contribution computations,
 * payslips), which is out of scope for this pass. Rather than fake a
 * payroll UI with nowhere real to save data, this page is honest about
 * what exists today: which clients are even eligible for payroll on
 * their current plan (`plans.features.payroll_locked`,
 * `plans.employee_limit` — see build spec §5), and nothing more.
 */
export default async function PayrollPage() {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("client_id, status, clients(id, business_name), plans(name, employee_limit, features)")
    .eq("status", "active");

  const rows = (subscriptions ?? []).map((s) => {
    const client = s.clients as unknown as {
      id: string;
      business_name: string;
    } | null;
    const plan = s.plans as unknown as {
      name: string;
      employee_limit: number | null;
      features: Record<string, unknown>;
    } | null;
    const locked = plan?.features?.payroll_locked === true;
    return { client, plan, locked };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground text-sm">
          Payroll runs and payslips aren&apos;t built yet. This page shows
          which clients are eligible for payroll under their current plan
          while that module is in progress.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <UsersRoundIcon className="text-muted-foreground size-5" />
          <CardTitle>Plan eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No active subscriptions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payroll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.client?.id}>
                    <TableCell>
                      {r.client ? (
                        <Link
                          href={`/clients/${r.client.id}`}
                          className="hover:underline"
                        >
                          {r.client.business_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{r.plan?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.locked ? (
                        <Badge variant="outline">Not included</Badge>
                      ) : (
                        <Badge variant="secondary">
                          Up to {r.plan?.employee_limit ?? "—"} employees —
                          coming soon
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
