import Link from "next/link";
import type { Metadata } from "next";

import { QueueFilterBar } from "@/app/(app)/receipts/review/queue-filter-bar";
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
import type { ReceiptStatus, ReportEntryType } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client Transactions — Celeste.bdc" };

const QUEUE_STATUSES: ReceiptStatus[] = [
  "uploaded",
  "processing",
  "needs_review",
  "ocr_failed",
];

export default async function ReceiptReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    q?: string;
    entryType?: string;
    dateFrom?: string;
    dateTo?: string;
    doneClientId?: string;
  }>;
}) {
  await requireRole("owner", "staff");
  const { clientId, q, entryType, dateFrom, dateTo, doneClientId } =
    await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("receipts")
    .select("*, clients(id, business_name)")
    .in("status", QUEUE_STATUSES)
    .order("created_at", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);
  if (q) query = query.ilike("vendor_name", `%${q}%`);
  if (entryType) query = query.eq("entry_type", entryType as ReportEntryType);
  if (dateFrom) query = query.gte("receipt_date", dateFrom);
  if (dateTo) query = query.lte("receipt_date", dateTo);

  const { data: receipts } = await query;
  const rows = receipts ?? [];

  const filteredClientName = rows[0]?.clients as unknown as
    | { business_name: string }
    | null;

  // Group by client for the "queue organized per-client" view.
  const byClient = new Map<
    string,
    { businessName: string; count: number }
  >();
  for (const r of rows) {
    const client = r.clients as unknown as { id: string; business_name: string } | null;
    if (!client) continue;
    const existing = byClient.get(client.id);
    if (existing) existing.count += 1;
    else byClient.set(client.id, { businessName: client.business_name, count: 1 });
  }
  const clientGroups = Array.from(byClient.entries()).sort((a, b) =>
    a[1].businessName.localeCompare(b[1].businessName),
  );

  let doneClientName: string | null = null;
  if (doneClientId) {
    const { data: doneClient } = await supabase
      .from("clients")
      .select("business_name")
      .eq("id", doneClientId)
      .maybeSingle();
    doneClientName = doneClient?.business_name ?? null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Client Transactions
        </h1>
        <p className="text-muted-foreground text-sm">
          {rows.length} transaction{rows.length === 1 ? "" : "s"} awaiting review
          {clientId && filteredClientName
            ? ` for ${filteredClientName.business_name}`
            : ""}
          .{" "}
          {clientId && (
            <Link href="/receipts/review" className="hover:underline">
              Clear filter
            </Link>
          )}
        </p>
      </div>

      {doneClientId && (
        <p className="rounded-md border border-dashed p-3 text-sm">
          {rows.some((r) => (r.clients as unknown as { id: string } | null)?.id === doneClientId)
            ? `Committed — continuing ${doneClientName ?? "this client"}'s queue.`
            : `You're all caught up for ${doneClientName ?? "that client"}! Back to the main queue.`}
        </p>
      )}

      <QueueFilterBar
        defaultQuery={q ?? ""}
        defaultEntryType={entryType ?? ""}
        defaultDateFrom={dateFrom ?? ""}
        defaultDateTo={dateTo ?? ""}
      />

      {!clientId && clientGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Queue by client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {clientGroups.map(([id, { businessName, count }]) => (
              <Link
                key={id}
                href={`/receipts/review?clientId=${id}`}
                className="bg-muted hover:bg-accent flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors"
              >
                {businessName}
                <span className="bg-background rounded-full px-1.5 text-xs">
                  {count}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Type</TableHead>
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
                      <TableCell className="capitalize">{r.entry_type}</TableCell>
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
