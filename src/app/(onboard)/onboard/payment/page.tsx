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
    supabase
      .from("payment_channels")
      .select("*")
      .eq("active", true)
      .eq("method", "gcash"),
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

  const channel = channels?.[0];
  const alreadyPaid =
    invoice && ["paid", "partially_paid"].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pay your first invoice
        </h1>
        <p className="text-muted-foreground text-sm">
          Pay via GCash and upload your proof of payment. Once we confirm it,
          you&apos;re set — meanwhile, continue to the next steps to finish
          your profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to pay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {channel ? (
            <>
              {channel.qr_image_data_url && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, next/image can't optimize it */}
                  <img
                    src={channel.qr_image_data_url}
                    alt="GCash QR code"
                    className="h-56 w-56 rounded-md border object-contain"
                  />
                </div>
              )}
              <div className="space-y-1">
                {channel.account_name && (
                  <p>
                    <span className="text-muted-foreground">Account name:</span>{" "}
                    <span className="font-medium">{channel.account_name}</span>
                  </p>
                )}
                {channel.account_number && (
                  <p>
                    <span className="text-muted-foreground">
                      GCash number:
                    </span>{" "}
                    <span className="font-medium">{channel.account_number}</span>
                  </p>
                )}
              </div>
              {channel.instructions && (
                <p className="text-muted-foreground">{channel.instructions}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Payment details haven&apos;t been set up yet — contact Celeste
              BDC for GCash payment instructions, or continue filling out
              your profile and pay once you have them.
            </p>
          )}
        </CardContent>
      </Card>

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
            payments={payments ?? []}
            canConfirm={false}
            canSubmit={!alreadyPaid}
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
