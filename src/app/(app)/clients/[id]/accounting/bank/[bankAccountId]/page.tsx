import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ReconciliationPanel } from "@/app/(app)/clients/[id]/accounting/bank/[bankAccountId]/reconciliation-panel";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reconcile bank account — Celeste.bdc" };

export default async function BankAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string; bankAccountId: string }>;
}) {
  await requireRole("owner", "staff");
  const { id, bankAccountId } = await params;

  const supabase = await createClient();
  const { data: bankAccount } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", bankAccountId)
    .single();

  if (!bankAccount) notFound();

  const [{ data: transactions }, { data: matchedRows }, { data: lines }] =
    await Promise.all([
      supabase
        .from("bank_transactions")
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .order("txn_date", { ascending: false }),
      supabase
        .from("bank_transactions")
        .select("matched_journal_line_id")
        .eq("client_id", id)
        .not("matched_journal_line_id", "is", null),
      bankAccount.gl_account_id
        ? supabase
            .from("journal_lines")
            .select(
              "id, debit, credit, memo, journal_entries!inner(entry_date, memo, status, client_id)",
            )
            .eq("account_id", bankAccount.gl_account_id)
            .eq("journal_entries.client_id", id)
            .eq("journal_entries.status", "posted")
        : Promise.resolve({ data: [] }),
    ]);

  const matchedIds = new Set(
    (matchedRows ?? []).map((r) => r.matched_journal_line_id),
  );

  const candidateLines = (lines ?? [])
    .filter((l) => !matchedIds.has(l.id))
    .map((l) => {
      const entry = l.journal_entries as unknown as {
        entry_date: string;
        memo: string | null;
      };
      return {
        id: l.id,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo,
        entry_date: entry.entry_date,
        entry_memo: entry.memo,
      };
    });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {bankAccount.bank_name} — {bankAccount.account_name}
        </h1>
        {!bankAccount.gl_account_id && (
          <p className="text-warning-foreground text-sm">
            No GL account linked — set one on the bank account before
            matching transactions.
          </p>
        )}
      </div>

      <ReconciliationPanel
        clientId={id}
        bankAccountId={bankAccountId}
        transactions={transactions ?? []}
        candidateLines={candidateLines}
      />
    </div>
  );
}
