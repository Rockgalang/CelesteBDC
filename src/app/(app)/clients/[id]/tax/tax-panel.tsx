"use client";

import { useState, useTransition } from "react";

import {
  markTaxObligationFiledAction,
  unmarkTaxObligationFiledAction,
} from "@/app/(app)/clients/[id]/tax/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila } from "@/lib/format";
import { isOverdue, type TaxObligation } from "@/lib/tax/deadlines";

export function TaxPanel({
  clientId,
  obligations,
  filedKinds,
}: {
  clientId: string;
  obligations: TaxObligation[];
  filedKinds: Set<string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onToggle = (o: TaxObligation, filed: boolean) => {
    setError(null);
    const key = `${o.formNumber}:${o.dueDate}`;
    setPendingKey(key);
    startTransition(async () => {
      const result = filed
        ? await unmarkTaxObligationFiledAction(clientId, o.formNumber, o.dueDate)
        : await markTaxObligationFiledAction(
            clientId,
            o.formNumber,
            o.dueDate,
            o.description,
          );
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Form</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {obligations.map((o) => {
            const key = `tax_filing:${o.formNumber}:${o.dueDate}`;
            const filed = filedKinds.has(key);
            const overdue = !filed && isOverdue(o.dueDate);
            return (
              <TableRow key={`${o.formNumber}-${o.dueDate}`}>
                <TableCell className="font-mono">{o.formNumber}</TableCell>
                <TableCell>{o.description}</TableCell>
                <TableCell>{formatManila(o.dueDate)}</TableCell>
                <TableCell>
                  {filed ? (
                    <Badge variant="success">Filed</Badge>
                  ) : overdue ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : (
                    <Badge variant="outline">Upcoming</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      isPending && pendingKey === `${o.formNumber}:${o.dueDate}`
                    }
                    onClick={() => onToggle(o, filed)}
                  >
                    {filed ? "Undo" : "Mark filed"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
