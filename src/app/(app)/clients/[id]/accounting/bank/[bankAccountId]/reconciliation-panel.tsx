"use client";

import { useRef, useState, useTransition } from "react";

import {
  importBankTransactionsAction,
  matchBankTransactionAction,
  unmatchBankTransactionAction,
} from "@/app/(app)/clients/[id]/accounting/bank/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { BankTransactionsRow } from "@/lib/supabase/types";

type CandidateLine = {
  id: string;
  debit: string;
  credit: string;
  memo: string | null;
  entry_date: string;
  entry_memo: string | null;
};

export function ReconciliationPanel({
  clientId,
  bankAccountId,
  transactions,
  candidateLines,
}: {
  clientId: string;
  bankAccountId: string;
  transactions: BankTransactionsRow[];
  candidateLines: CandidateLine[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isImporting, startImport] = useTransition();
  const [isMatching, startMatch] = useTransition();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const onImport = (formData: FormData) => {
    setError(null);
    setSummary(null);
    startImport(async () => {
      const result = await importBankTransactionsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(
        `Imported ${result.imported ?? 0} transaction(s), skipped ${result.skipped ?? 0} duplicate(s).`,
      );
      formRef.current?.reset();
    });
  };

  const onMatch = (transactionId: string) => {
    const lineId = selected[transactionId];
    if (!lineId) {
      setError("Choose a transaction to match against first.");
      return;
    }
    setError(null);
    startMatch(async () => {
      const result = await matchBankTransactionAction(
        clientId,
        bankAccountId,
        transactionId,
        lineId,
      );
      if (!result.ok) setError(result.error);
    });
  };

  const onUnmatch = (transactionId: string) => {
    setError(null);
    startMatch(async () => {
      const result = await unmatchBankTransactionAction(
        clientId,
        bankAccountId,
        transactionId,
      );
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form ref={formRef} action={onImport} className="space-y-3">
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="bankAccountId" value={bankAccountId} />
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV file</Label>
              <Input id="csv-file" name="file" type="file" accept=".csv" required />
              <p className="text-muted-foreground text-xs">
                Columns: date, description, amount (positive = money in,
                negative = money out), optional reference. A header row is
                detected automatically.
              </p>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {summary && <p className="text-sm">{summary}</p>}
            <Button type="submit" size="sm" disabled={isImporting}>
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No transactions imported yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatManila(t.txn_date)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {t.description}
                    </TableCell>
                    <TableCell>{formatPeso(money(t.amount))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.match_status === "matched" ? "success" : "outline"
                        }
                      >
                        {t.match_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.match_status === "matched" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isMatching}
                          onClick={() => onUnmatch(t.id)}
                        >
                          Unmatch
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            value={selected[t.id] ?? ""}
                            onValueChange={(v) =>
                              setSelected((s) => ({ ...s, [t.id]: v }))
                            }
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="Choose journal line" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidateLines.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {formatManila(l.entry_date)} —{" "}
                                  {l.entry_memo ?? l.memo ?? "(no memo)"} —{" "}
                                  {formatPeso(
                                    money(
                                      Number(l.debit) > 0 ? l.debit : l.credit,
                                    ),
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={isMatching}
                            onClick={() => onMatch(t.id)}
                          >
                            Match
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Separator />
    </div>
  );
}
