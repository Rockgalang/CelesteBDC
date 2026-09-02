import Link from "next/link";
import type { Metadata } from "next";

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
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { ReceiptStatus } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipt review — Celeste.bdc" };

const QUEUE_STATUSES: ReceiptStatus[] = [
  "uploaded",
  "processing",
  "needs_review",
  "ocr_failed",
];

export default async function ReceiptReviewQueuePage() {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { data: receipts } = await supabase
    .from("receipts")
    .select("*, clients(id, business_name)")
    .in("status", QUEUE_STATUSES)
    .order("created_at", { ascending: true });

  const rows = receipts ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Receipt review
        </h1>
        <p className="text-muted-foreground text-sm">
          {rows.length} receipt{rows.length === 1 ? "" : "s"} awaiting review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">All caught up.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const client = r.clients as unknown as {
                    id: string;
                    business_name: string;
                  } | null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link
                          href={`/receipts/review/${r.id}`}
                          className="hover:underline"
                        >
                          {client?.business_name ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{r.vendor_name ?? "—"}</TableCell>
                      <TableCell>
                        {r.receipt_date ? formatManila(r.receipt_date) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.amount ? formatPeso(money(r.amount)) : "—"}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {r.possible_duplicate_of && (
                          <Badge variant="warning">Possible duplicate</Badge>
                        )}
                        {r.status === "ocr_failed" && (
                          <Badge variant="outline">OCR failed</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatManila(r.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
