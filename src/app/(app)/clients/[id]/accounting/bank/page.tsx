import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BankAccountsPanel } from "@/app/(app)/clients/[id]/accounting/bank/bank-accounts-panel";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bank accounts — Celeste.bdc" };

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: bankAccounts }, { data: cashAccounts }] =
    await Promise.all([
      supabase.from("clients").select("id, business_name").eq("id", id).single(),
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("client_id", id)
        .order("bank_name"),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("client_id", id)
        .eq("type", "asset")
        .eq("active", true)
        .order("code"),
    ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bank — {client.business_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Import bank statements and reconcile against posted transactions.
        </p>
      </div>

      <BankAccountsPanel
        clientId={id}
        bankAccounts={bankAccounts ?? []}
        cashAccounts={cashAccounts ?? []}
      />
    </div>
  );
}
