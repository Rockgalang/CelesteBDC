import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InvoiceStatusBadge } from "@/app/(app)/invoices/invoice-status-badge";
import { InvoiceLetterheadHeader } from "@/app/(app)/invoices/invoice-letterhead-header";
import { IssueInvoiceButton } from "@/app/(app)/invoices/[id]/issue-invoice-button";
import { PaymentPanel } from "@/app/(app)/invoices/[id]/payment-panel";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClientBackLink } from "@/components/workspace/client-back-link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice — Celeste.bdc" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: invoice }, { data: lines }, { data: payments }, { data: channels }, { data: letterhead }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*, clients(id, business_name)")
        .eq("id", id)
        .single(),
      supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id)
        .order("created_at"),
      supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .order("created_at"),
      supabase.from("payment_channels").select("*").eq("active", true),
      supabase.from("invoice_letterhead").select("*").eq("id", 1).maybeSingle(),
    ]);

  if (!invoice) notFound();

  const client = invoice.clients as unknown as {
    id: string;
    business_name: string;
  } | null;
  const internal = isInternalRole(profile.role);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <InvoiceLetterheadHeader letterhead={letterhead ?? null} />
      <div>
        {internal && client ? (
          <ClientBackLink clientId={client.id} businessName={client.business_name} />
        ) : (
          <p className="text-muted-foreground text-sm">{client?.business_name}</p>
        )}
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {invoice.number ?? "Draft invoice"}
          </h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          Issued {formatManila(invoice.issue_date)} · Due{" "}
          {formatManila(invoice.due_date)}
        </p>
        {internal && invoice.status === "draft" && (
          <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
            <p className="text-muted-foreground text-sm">
              This is an extra-charge draft — attach the client&apos;s proof
              of payment below, then issue it.
            </p>
            <IssueInvoiceButton invoiceId={invoice.id} />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell>{line.qty}</TableCell>
                  <TableCell>{formatPeso(money(line.unit_price))}</TableCell>
                  <TableCell>{formatPeso(money(line.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell>{formatPeso(money(invoice.total))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">
            Excludes certification fees, mobilization fees, LGU fees, and other
            government fees, which bill separately.
          </p>
        </CardFooter>
      </Card>

      <PaymentPanel
        invoiceId={invoice.id}
        clientId={invoice.client_id}
        invoiceTotal={invoice.total}
        payments={payments ?? []}
        channels={channels ?? []}
        canConfirm={internal}
        canSubmit={profile.role === "client_admin"}
      />
    </div>
  );
}
