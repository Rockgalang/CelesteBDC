import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChartOfAccountsPanel } from "@/app/(app)/clients/[id]/accounting/chart-of-accounts-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accounting — Celeste.bdc" };

export default async function ClientAccountingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: accounts }, { data: templateSets }] =
    await Promise.all([
      supabase.from("clients").select("id").eq("id", id).single(),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("client_id", id)
        .order("code"),
      supabase
        .from("chart_of_account_template_sets")
        .select("id, name, is_builtin")
        .order("is_builtin", { ascending: false })
        .order("name"),
    ]);

  if (!client) notFound();

  return (
    <ChartOfAccountsPanel
      clientId={id}
      accounts={accounts ?? []}
      templateSets={templateSets ?? []}
    />
  );
}
