import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { InvoiceStatusBadge } from "@/app/(app)/invoices/invoice-status-badge";
import { InvoicesFilterBar } from "@/app/(app)/invoices/invoices-filter-bar";
import { TipsPanel } from "@/app/(app)/invoices/tips-panel";
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
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";
import { formatManila, formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Payments — Celeste.bdc" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!isInternalRole(profile.role) && profile.role !== "client_admin") {
    // client_user is excluded from invoices per build spec §4.
    return (
      <p className="text-muted-foreground text-sm">
        Invoices are visible to your client admin.
      </p>
    );
  }

  const internal = isInternalRole(profile.role);
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let invoicesQuery = supabase
    .from("invoices")
    .select(
      "id, number, issue_date, due_date, total, status, clients(business_name)",
    )
    .neq("status", "draft")
    .order("issue_date", { ascending: false });
  if (status) {
    invoicesQuery = invoicesQuery.eq("status", status as InvoiceStatus);
  }

  let matchingClientIds: string[] | null = null;
  if (q && internal) {
    const { data: matchingClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("business_name", `%${q}%`);
    matchingClientIds = (matchingClients ?? []).map((c) => c.id);
  }
  if (q) {
    if (matchingClientIds && matchingClientIds.length > 0) {
      invoicesQuery = invoicesQuery.or(
        `number.ilike.%${q}%,client_id.in.(${matchingClientIds.join(",")})`,
      );
    } else {
      invoicesQuery = invoicesQuery.ilike("number", `%${q}%`);
    }
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [{ data: invoices }, dashboard, { data: tips }] = await Promise.all([
    invoicesQuery,
    internal
      ? Promise.all([
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "confirmed")
            .gte("paid_at", monthStartStr),
          supabase.from("payments").select("id", { count: "exact", head: true }).eq(
            "status",
            "submitted",
          ),
          supabase.from("tips").select("id", { count: "exact", head: true }).eq(
            "status",
            "submitted",
          ),
          supabase
            .from("tips")
            .select("amount")
            .eq("status", "confirmed")
            .gte("confirmed_at", monthStartStr),
          supabase
            .from("invoices")
            .select("total, payments(amount, status)")
            .in("status", ["issued", "partially_paid", "overdue"]),
        ])
      : Promise.resolve(null),
    internal
      ? supabase
          .from("tips")
          .select("*, clients(business_name)")
          .order("created_at", { ascending: false })
          .limit(20)
      : supabase
          .from("tips")
          .select("*")
          .eq("client_id", profile.client_id ?? "")
          .order("created_at", { ascending: false })
          .limit(20),
  ]);

  let earningsThisMonth = ZERO;
  let pendingPaymentsCount = 0;
  let pendingTipsCount = 0;
  let outstandingBalance = ZERO;

  if (dashboard) {
    const [
      { data: confirmedPayments },
      { count: submittedPaymentsCount },
      { count: submittedTipsCount },
      { data: confirmedTips },
      { data: unpaidInvoices },
    ] = dashboard;

    earningsThisMonth = (confirmedPayments ?? [])
      .reduce((sum, p) => sum.plus(money(p.amount)), ZERO)
      .plus(
        (confirmedTips ?? []).reduce((sum, t) => sum.plus(money(t.amount)), ZERO),
      );
    pendingPaymentsCount = submittedPaymentsCount ?? 0;
    pendingTipsCount = submittedTipsCount ?? 0;

    outstandingBalance = (unpaidInvoices ?? []).reduce((sum, inv) => {
      const confirmed = (
        (inv.payments as unknown as { amount: string; status: string }[]) ?? []
      )
        .filter((p) => p.status === "confirmed")
        .reduce((s, p) => s.plus(money(p.amount)), ZERO);
      return sum.plus(money(inv.total).minus(confirmed));
    }, ZERO);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-muted-foreground text-sm">
            {invoices?.length ?? 0} invoice{invoices?.length === 1 ? "" : "s"}.
          </p>
        </div>
        {internal && (
          <Button asChild size="sm">
            <Link href="/invoices/new">
              <PlusIcon className="size-4" />
              New charge
            </Link>
          </Button>
        )}
      </div>

      {internal && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Earnings this month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatPeso(earningsThisMonth)}
              </p>
              <p className="text-muted-foreground text-xs">
                Confirmed payments + tips
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Pending review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {pendingPaymentsCount + pendingTipsCount}
              </p>
              <p className="text-muted-foreground text-xs">
                {pendingPaymentsCount} payment{pendingPaymentsCount === 1 ? "" : "s"} ·{" "}
                {pendingTipsCount} tip{pendingTipsCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Outstanding balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatPeso(outstandingBalance)}
              </p>
              <p className="text-muted-foreground text-xs">
                Across unpaid/partially paid invoices
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {internal && (
        <InvoicesFilterBar defaultQuery={q ?? ""} defaultStatus={status ?? ""} />
      )}

      {invoices && invoices.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                {internal && <TableHead>Client</TableHead>}
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.number ?? "—"}
                    </Link>
                  </TableCell>
                  {internal && (
                    <TableCell>
                      {(
                        inv.clients as unknown as {
                          business_name: string;
                        } | null
                      )?.business_name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>{formatManila(inv.issue_date)}</TableCell>
                  <TableCell>{formatManila(inv.due_date)}</TableCell>
                  <TableCell>{formatPeso(money(inv.total))}</TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No invoices yet.
        </div>
      )}

      <TipsPanel
        clientId={profile.client_id}
        canManage={internal}
        tips={tips ?? []}
      />
    </div>
  );
}
