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
  const [{ data: client }, { data: accounts }] = await Promise.all([
    supabase.from("clients").select("id").eq("id", id).single(),
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("client_id", id)
      .order("code"),
  ]);

  if (!client) notFound();

  return <ChartOfAccountsPanel clientId={id} accounts={accounts ?? []} />;
}
