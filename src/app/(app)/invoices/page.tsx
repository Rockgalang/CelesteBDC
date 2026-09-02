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
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoices — Celeste.bdc" };

export default async function InvoicesPage() {
  const profile = await getCurrentProfile();
  if (!isInternalRole(profile.role) && profile.role !== "client_admin") {
    // client_user is excluded from invoices per build spec §4.
    return (
      <p className="text-muted-foreground text-sm">
        Invoices are visible to your client admin.
      </p>
    );
  }

  const showClientColumn = isInternalRole(profile.role);
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, number, issue_date, due_date, total, status, clients(business_name)",
    )
    .neq("status", "draft")
    .order("issue_date", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">
          {invoices?.length ?? 0} invoice{invoices?.length === 1 ? "" : "s"}.
        </p>
      </div>

      {invoices && invoices.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                {showClientColumn && <TableHead>Client</TableHead>}
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
                  {showClientColumn && (
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
    </div>
  );
}
