import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { ClientsFilterBar } from "@/app/(app)/clients/clients-filter-bar";
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
import { CLIENT_STATUS_VARIANT } from "@/lib/client-status";
import { formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Clients — Celeste.bdc" };

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole("owner", "staff");
  const { q, status } = await searchParams;

  const supabase = await createClient();
  const { start, end } = currentMonthRange();

  let clientsQuery = supabase
    .from("clients")
    .select("id, business_name, trade_name, entity_type, status, city")
    .order("business_name", { ascending: true });
  if (q) clientsQuery = clientsQuery.ilike("business_name", `%${q}%`);
  if (status) clientsQuery = clientsQuery.eq("status", status as ClientStatus);

  const [
    { data: clients },
    { count: activeSubCount },
    { data: monthPayments },
    { count: blockedJobsCount },
    { count: pendingPaymentsCount },
    { count: receiptsQueueCount },
    { data: unpaidInvoices },
  ] = await Promise.all([
    clientsQuery,
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "confirmed")
      .gte("paid_at", start)
      .lt("paid_at", end),
    supabase
      .from("registration_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .in("status", ["uploaded", "processing", "needs_review", "ocr_failed"]),
    supabase
      .from("invoices")
      .select("total")
      .in("status", ["issued", "partially_paid", "overdue"]),
  ]);

  const earningsThisMonth = (monthPayments ?? []).reduce(
    (sum, p) => sum.plus(money(p.amount)),
    ZERO,
  );
  const unpaidTotal = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum.plus(money(inv.total)),
    ZERO,
  );
  const pendingTasksCount =
    (blockedJobsCount ?? 0) + (pendingPaymentsCount ?? 0) + (receiptsQueueCount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm">
            {clients?.length ?? 0} client{clients?.length === 1 ? "" : "s"}
            {q || status ? " matching your filters" : " on file"}.
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusIcon />
            New client
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{activeSubCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Earnings this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatPeso(earningsThisMonth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{pendingTasksCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Unpaid across all clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatPeso(unpaidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <ClientsFilterBar defaultQuery={q ?? ""} defaultStatus={status ?? ""} />

      {clients && clients.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business name</TableHead>
                <TableHead>Entity type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow
                  key={c.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="block hover:underline">
                      <div className="font-medium">{c.business_name}</div>
                      {c.trade_name && (
                        <div className="text-muted-foreground text-xs">
                          {c.trade_name}
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">
                    {c.entity_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={CLIENT_STATUS_VARIANT[c.status] ?? "secondary"}
                      className="capitalize"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          {q || status
            ? "No clients match your filters."
            : "No clients yet. Add your first one to get started."}
        </div>
      )}
    </div>
  );
}
