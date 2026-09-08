import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { FS_DISCLAIMER } from "@/lib/copy/disclaimers";
import { formatPeso } from "@/lib/format";
import { money, ZERO, type Money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, NormalBalance } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Financials — Celeste.bdc" };

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

export default async function ClientFinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await getCurrentProfile();
  const { period: periodParam } = await searchParams;
  const period = periodParam || currentMonth();

  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste
        BDC representative.
      </p>
    );
  }

  const supabase = await createClient();
  const [{ data: accounts }, { data: lines }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("client_id", profile.client_id)
      .order("code"),
    supabase
      .from("journal_lines")
      .select(
        "account_id, debit, credit, journal_entries!inner(period, status, client_id)",
      )
      .eq("journal_entries.client_id", profile.client_id)
      .eq("journal_entries.status", "posted")
      .lte("journal_entries.period", period),
  ]);

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
      const pAgg = periodOnly.get(line.account_id) ?? { debit: ZERO, credit: ZERO };
      periodOnly.set(line.account_id, {
        debit: pAgg.debit.plus(debit),
        credit: pAgg.credit.plus(credit),
      });
    }
  }

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

  const hasAnyData = (accounts?.length ?? 0) > 0 && (lines?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financials</h1>
        <p className="text-muted-foreground text-sm">
          Profit & loss and balance sheet for {period}, as posted by Celeste
          BDC&apos;s bookkeeping team.
        </p>
      </div>

      {!hasAnyData ? (
        <p className="text-muted-foreground text-sm">
          Nothing posted yet — once Cel&apos;s team processes your first
          receipts, your statements will appear here.
        </p>
      ) : (
        <>
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
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total equity</TableCell>
                      <TableCell>{formatPeso(equityTotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-muted-foreground mx-auto max-w-2xl text-center text-xs">
        {FS_DISCLAIMER}
      </p>
    </div>
  );
}
