import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PeriodPanel } from "@/app/(app)/clients/[id]/accounting/financials/period-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/current-profile";
import { formatPeso } from "@/lib/format";
import { money, ZERO, type Money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, NormalBalance } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Financial statements — Celeste.bdc" };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function accountNet(
  account: { normal_balance: NormalBalance },
  debit: Money,
  credit: Money,
) {
  return account.normal_balance === "debit"
    ? debit.minus(credit)
    : credit.minus(debit);
}

export default async function FinancialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await requireRole("owner", "staff");
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period = periodParam || currentMonth();

  const supabase = await createClient();
  const [{ data: client }, { data: periods }, { data: accounts }, { data: lines }] =
    await Promise.all([
      supabase.from("clients").select("id, business_name").eq("id", id).single(),
      supabase
        .from("accounting_periods")
        .select("*")
        .eq("client_id", id)
        .order("period", { ascending: false }),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("client_id", id)
        .order("code"),
      supabase
        .from("journal_lines")
        .select(
          "account_id, debit, credit, journal_entries!inner(period, status, client_id)",
        )
        .eq("journal_entries.client_id", id)
        .eq("journal_entries.status", "posted")
        .lte("journal_entries.period", period),
    ]);

  if (!client) notFound();

  // Two aggregates over the same fetched lines: cumulative (through the
  // selected period, for the trial balance / balance sheet) and
  // period-only (for the income statement) — split by journal_entries.period.
  const cumulative = new Map<string, { debit: Money; credit: Money }>();
  const periodOnly = new Map<string, { debit: Money; credit: Money }>();

  for (const line of lines ?? []) {
    const entry = line.journal_entries as unknown as { period: string };
    const debit = money(line.debit);
    const credit = money(line.credit);

    const cAgg = cumulative.get(line.account_id) ?? { debit: ZERO, credit: ZERO };
    cumulative.set(line.account_id, {
      debit: cAgg.debit.plus(debit),
      credit: cAgg.credit.plus(credit),
    });

    if (entry.period === period) {
      const pAgg = periodOnly.get(line.account_id) ?? {
        debit: ZERO,
        credit: ZERO,
      };
      periodOnly.set(line.account_id, {
        debit: pAgg.debit.plus(debit),
        credit: pAgg.credit.plus(credit),
      });
    }
  }

  const trialBalanceRows = (accounts ?? [])
    .map((a) => {
      const agg = cumulative.get(a.id) ?? { debit: ZERO, credit: ZERO };
      const net = agg.debit.minus(agg.credit);
      return { account: a, net };
    })
    .filter((r) => !r.net.isZero());

  const debitColumnTotal = trialBalanceRows.reduce(
    (sum, r) => (r.net.gt(0) ? sum.plus(r.net) : sum),
    ZERO,
  );
  const creditColumnTotal = trialBalanceRows.reduce(
    (sum, r) => (r.net.lt(0) ? sum.plus(r.net.abs()) : sum),
    ZERO,
  );

  const byType = (type: AccountType, agg: Map<string, { debit: Money; credit: Money }>) =>
    (accounts ?? [])
      .filter((a) => a.type === type)
      .map((a) => {
        const v = agg.get(a.id) ?? { debit: ZERO, credit: ZERO };
        return { account: a, net: accountNet(a, v.debit, v.credit) };
      })
      .filter((r) => !r.net.isZero());

  const revenueRows = byType("revenue", periodOnly);
  const expenseRows = byType("expense", periodOnly);
  const revenueTotal = revenueRows.reduce((s, r) => s.plus(r.net), ZERO);
  const expenseTotal = expenseRows.reduce((s, r) => s.plus(r.net), ZERO);
  const netIncome = revenueTotal.minus(expenseTotal);

  const assetRows = byType("asset", cumulative);
  const liabilityRows = byType("liability", cumulative);
  const equityRows = byType("equity", cumulative);
  const assetsTotal = assetRows.reduce((s, r) => s.plus(r.net), ZERO);
  const liabilitiesTotal = liabilityRows.reduce((s, r) => s.plus(r.net), ZERO);
  const equityTotal = equityRows.reduce((s, r) => s.plus(r.net), ZERO);

  const revenueRowsToDate = byType("revenue", cumulative);
  const expenseRowsToDate = byType("expense", cumulative);
  const netIncomeToDate = revenueRowsToDate
    .reduce((s, r) => s.plus(r.net), ZERO)
    .minus(expenseRowsToDate.reduce((s, r) => s.plus(r.net), ZERO));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Financials — {client.business_name}
        </h1>
      </div>

      <PeriodPanel
        clientId={id}
        period={period}
        periods={periods ?? []}
        isOwner={profile.role === "owner"}
      />

      <Card>
        <CardHeader>
          <CardTitle>Trial balance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trialBalanceRows.map((r) => (
                <TableRow key={r.account.id}>
                  <TableCell>
                    {r.account.code} — {r.account.name}
                  </TableCell>
                  <TableCell>{r.net.gt(0) ? formatPeso(r.net) : ""}</TableCell>
                  <TableCell>
                    {r.net.lt(0) ? formatPeso(r.net.abs()) : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell>{formatPeso(debitColumnTotal)}</TableCell>
                <TableCell>{formatPeso(creditColumnTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income statement — {period}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Revenue</p>
            <Table>
              <TableBody>
                {revenueRows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>{r.account.name}</TableCell>
                    <TableCell>{formatPeso(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Expenses</p>
            <Table>
              <TableBody>
                {expenseRows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>{r.account.name}</TableCell>
                    <TableCell>{formatPeso(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between border-t pt-2 text-sm font-semibold">
            <span>Net income</span>
            <span>{formatPeso(netIncome)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance sheet — as of end of {period}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Assets</p>
            <Table>
              <TableBody>
                {assetRows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>{r.account.name}</TableCell>
                    <TableCell>{formatPeso(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total assets</TableCell>
                  <TableCell>{formatPeso(assetsTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Liabilities</p>
            <Table>
              <TableBody>
                {liabilityRows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>{r.account.name}</TableCell>
                    <TableCell>{formatPeso(r.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total liabilities</TableCell>
                  <TableCell>{formatPeso(liabilitiesTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Equity</p>
            <Table>
              <TableBody>
                {equityRows.map((r) => (
                  <TableRow key={r.account.id}>
                    <TableCell>{r.account.name}</TableCell>
                    <TableCell>{formatPeso(r.net)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>
                    Net income to date (not yet closed to equity)
                  </TableCell>
                  <TableCell>{formatPeso(netIncomeToDate)}</TableCell>
                </TableRow>
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total equity</TableCell>
                  <TableCell>
                    {formatPeso(equityTotal.plus(netIncomeToDate))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        Compiled — Management Accounts. Not audited.
      </p>
    </div>
  );
}
