import Link from "next/link";
import type { Metadata } from "next";
import { UsersRoundIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payroll — Celeste.bdc" };

export default async function PayrollPage() {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const [{ data: subscriptions }, { data: employeeCounts }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "client_id, status, clients(id, business_name), plans(name, employee_limit, features)",
      )
      .eq("status", "active"),
    supabase.from("employees").select("client_id, status").eq("status", "active"),
  ]);

  const activeCountByClient = new Map<string, number>();
  for (const e of employeeCounts ?? []) {
    activeCountByClient.set(
      e.client_id,
      (activeCountByClient.get(e.client_id) ?? 0) + 1,
    );
  }

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
    const activeEmployees = client ? (activeCountByClient.get(client.id) ?? 0) : 0;
    return { client, plan, locked, activeEmployees };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground text-sm">
          Every client with an active subscription, their plan&apos;s
          payroll eligibility, and how many active employees are on file.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <UsersRoundIcon className="text-muted-foreground size-5" />
          <CardTitle>Clients</CardTitle>
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
                  <TableHead>Employees</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.client?.id}>
                    <TableCell>{r.client?.business_name ?? "—"}</TableCell>
                    <TableCell>{r.plan?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.locked ? (
                        <Badge variant="outline">Not included</Badge>
                      ) : (
                        <span>
                          {r.activeEmployees}
                          {r.plan?.employee_limit !== null &&
                            r.plan?.employee_limit !== undefined &&
                            ` / ${r.plan.employee_limit}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.client && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/clients/${r.client.id}/payroll`}>
                            Manage
                          </Link>
                        </Button>
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
