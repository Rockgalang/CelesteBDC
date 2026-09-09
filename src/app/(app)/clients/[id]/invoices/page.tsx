import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { InvoiceStatusBadge } from "@/app/(app)/invoices/invoice-status-badge";
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
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Subscription & Billing — Celeste.bdc" };

export default async function ClientInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: invoices }, { data: acceptedExtraCharges }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, issue_date, due_date, total, status")
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("extra_registration_requests")
      .select("id, label, quoted_fee")
      .eq("client_id", id)
      .eq("status", "accepted"),
  ]);

  return (
    <div className="space-y-6">
      {acceptedExtraCharges && acceptedExtraCharges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Accepted extra charges awaiting billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {acceptedExtraCharges.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {req.label} — {formatPeso(money(req.quoted_fee ?? "0"))}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/invoices/new?clientId=${id}`}>
                    Create charge
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {invoices?.length ?? 0} invoice{invoices?.length === 1 ? "" : "s"}.
        </p>
        <Button asChild size="sm">
          <Link href={`/invoices/new?clientId=${id}`}>
            <PlusIcon className="size-4" />
            New charge
          </Link>
        </Button>
      </div>

      {invoices && invoices.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="group">
                <TableCell>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="group-hover:text-primary font-medium transition-colors"
                  >
                    {invoice.number ?? "Draft"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatManila(invoice.issue_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatManila(invoice.due_date)}
                </TableCell>
                <TableCell>{formatPeso(money(invoice.total))}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground text-sm">
          No invoices yet for this client.
        </p>
      )}
    </div>
  );
}
