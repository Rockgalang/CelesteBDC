import Link from "next/link";
import type { Metadata } from "next";

import { InvoiceStatusBadge } from "@/app/(app)/invoices/invoice-status-badge";
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

export const metadata: Metadata = { title: "Invoices — Celeste.bdc" };

export default async function ClientInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, issue_date, due_date, total, status")
    .eq("client_id", id)
    .neq("status", "draft")
    .order("issue_date", { ascending: false });

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {invoices?.length ?? 0} invoice{invoices?.length === 1 ? "" : "s"}.
      </p>

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
