import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BankAccountsPanel } from "@/app/(app)/clients/[id]/accounting/bank/bank-accounts-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bank accounts — Celeste.bdc" };

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: bankAccounts }, { data: cashAccounts }] =
    await Promise.all([
      supabase.from("clients").select("id").eq("id", id).single(),
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
    <BankAccountsPanel
      clientId={id}
      bankAccounts={bankAccounts ?? []}
      cashAccounts={cashAccounts ?? []}
    />
  );
}
