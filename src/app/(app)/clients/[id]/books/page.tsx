import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ReportsTable } from "@/app/(app)/reports/reports-table";
import {
  LedgerImportPanel,
  type ImportBatchWithRows,
} from "@/app/(app)/reports/ledger-import-panel";
import type { LedgerRow } from "@/app/(app)/reports/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Books — Celeste.bdc" };

export default async function ClientBooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: receipts }, { data: manualEntries }, { data: importBatches }] =
    await Promise.all([
      supabase.from("clients").select("id").eq("id", id).single(),
      supabase
        .from("receipts")
        .select("id, entry_type, vendor_name, receipt_date, amount, category, status, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("manual_ledger_entries")
        .select("*")
        .eq("client_id", id)
        .order("entry_date", { ascending: false }),
      supabase
        .from("ledger_import_batches")
        .select("*, rows:ledger_import_rows(*)")
        .eq("client_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  if (!client) notFound();

  const batches = (importBatches ?? []) as unknown as ImportBatchWithRows[];

  const rows: LedgerRow[] = [
    ...(receipts ?? []).map((r) => ({
      id: r.id,
      source: "receipt" as const,
      entryType: r.entry_type,
      date: r.receipt_date ?? r.created_at.slice(0, 10),
      description: r.vendor_name ?? "(vendor unknown)",
      amount: r.amount ?? "0",
      category: r.category,
      status: r.status,
    })),
    ...(manualEntries ?? []).map((m) => ({
      id: m.id,
      source: "manual" as const,
      entryType: m.entry_type,
      date: m.entry_date,
      description: m.description,
      amount: m.amount,
      category: m.category,
      status: null,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
        <p className="text-muted-foreground text-sm">
          Every receipt and manual entry for this client, filterable by type
          and date. Export to CSV any time, or review and commit a client&apos;s
          CSV import below.
        </p>
      </div>
      <ReportsTable rows={rows} clientId={id} />
      <LedgerImportPanel clientId={id} canCommit={true} batches={batches} />
    </div>
  );
}
