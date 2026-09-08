import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentPanel } from "@/app/(app)/invoices/[id]/payment-panel";
import { InvoiceStatusBadge } from "@/app/(app)/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardPaymentPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    redirect("/onboard");
  }

  const supabase = await createClient();
  const [{ data: invoice }, { data: channels }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("client_id", profile.client_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("payment_channels").select("*").eq("active", true),
  ]);

  const [{ data: lines }, { data: payments }] = await Promise.all([
    invoice
      ? supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    invoice
      ? supabase
          .from("payments")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pay your first invoice
        </h1>
        <p className="text-muted-foreground text-sm">
          Pick how you paid and upload your proof of payment. Once we confirm
          it, you&apos;re set — meanwhile, continue to the next steps to
          finish your profile.
        </p>
      </div>

      {invoice ? (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                {invoice.number ?? "Your invoice"}
              </CardTitle>
              <InvoiceStatusBadge status={invoice.status} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lines ?? []).map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>{formatPeso(money(line.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell>{formatPeso(money(invoice.total))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <PaymentPanel
            invoiceId={invoice.id}
            clientId={invoice.client_id}
            invoiceTotal={invoice.total}
            payments={payments ?? []}
            channels={channels ?? []}
            canConfirm={false}
            canSubmit
          />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">No invoice found yet.</p>
      )}

      <div className="flex justify-end">
        <Button asChild>
          <Link href="/onboard/business">Continue to business details</Link>
        </Button>
      </div>
    </div>
  );
}
