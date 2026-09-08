import type { Metadata } from "next";

import { ReportsTable } from "@/app/(app)/reports/reports-table";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import type { LedgerRow } from "@/app/(app)/reports/types";

export const metadata: Metadata = { title: "Reports — Celeste.bdc" };

export default async function ReportsPage() {
  const profile = await getCurrentProfile();

  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste
        BDC representative.
      </p>
    );
  }

  const supabase = await createClient();
  const [{ data: receipts }, { data: manualEntries }] = await Promise.all([
    supabase
      .from("receipts")
      .select("id, entry_type, vendor_name, receipt_date, amount, category, status, created_at")
      .eq("client_id", profile.client_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("manual_ledger_entries")
      .select("*")
      .eq("client_id", profile.client_id)
      .order("entry_date", { ascending: false }),
  ]);

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Sales & expense reports
        </h1>
        <p className="text-muted-foreground text-sm">
          Every receipt you upload lands here automatically. Add quick
          entries directly too — think of this as your own running
          register. Export to CSV any time.
        </p>
      </div>
      <ReportsTable rows={rows} />
    </div>
  );
}
