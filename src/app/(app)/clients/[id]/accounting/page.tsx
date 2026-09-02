import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ChartOfAccountsPanel } from "@/app/(app)/clients/[id]/accounting/chart-of-accounts-panel";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accounting — Celeste.bdc" };

export default async function ClientAccountingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: accounts }] = await Promise.all([
    supabase.from("clients").select("id, business_name").eq("id", id).single(),
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("client_id", id)
      .order("code"),
  ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Accounting — {client.business_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Chart of accounts, bank reconciliation, and financial statements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${id}/accounting/bank`}>Bank</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${id}/accounting/financials`}>
              Financials
            </Link>
          </Button>
        </div>
      </div>

      <ChartOfAccountsPanel clientId={id} accounts={accounts ?? []} />
    </div>
  );
}
