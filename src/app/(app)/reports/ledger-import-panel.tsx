"use client";

import { useRef, useState, useTransition } from "react";
import { DownloadIcon } from "lucide-react";

import {
  commitLedgerImportBatchAction,
  rejectLedgerImportBatchAction,
  setLedgerImportRowStatusAction,
  uploadLedgerImportAction,
} from "@/lib/ledger/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type {
  LedgerImportBatchesRow,
  LedgerImportRowsRow,
} from "@/lib/supabase/types";

// Mirrors importCsvTemplate() in @/lib/ledger/csv — that module is
// server-only, so this client component keeps its own copy.
const TEMPLATE_CSV = "date,type,description,category,amount\n2026-06-01,sale,Daily sales,sales,5000.00\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "celeste-ledger-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ImportBatchWithRows = LedgerImportBatchesRow & {
  rows: LedgerImportRowsRow[];
};

export function LedgerImportPanel({
  clientId,
  canCommit,
  batches,
}: {
  clientId: string;
  canCommit: boolean;
  batches: ImportBatchWithRows[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const text = await file.text();
      const result = await uploadLedgerImportAction(clientId, file.name, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Import from CSV</CardTitle>
        <Button size="sm" variant="outline" onClick={downloadTemplate}>
          <DownloadIcon className="size-4" />
          Download template
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Download the template, fill it in, then upload it here. Nothing
          posts to the books right away — Cel reviews every upload and
          commits it (or rejects it) from here before it counts.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            disabled={isPending}
            className="text-sm"
          />
          {isPending && (
            <span className="text-muted-foreground text-sm">Uploading...</span>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}

        {batches.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            {batches.map((batch) => (
              <ImportBatchCard
                key={batch.id}
                batch={batch}
                clientId={clientId}
                canCommit={canCommit}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImportBatchCard({
  batch,
  clientId,
  canCommit,
}: {
  batch: ImportBatchWithRows;
  clientId: string;
  canCommit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const includedCount = batch.rows.filter((r) => r.status !== "skipped").length;

  const onToggleSkip = (rowId: string, currentlySkipped: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setLedgerImportRowStatusAction(
        rowId,
        clientId,
        currentlySkipped ? "pending" : "skipped",
      );
      if (!result.ok) setError(result.error);
    });
  };

  const onCommit = () => {
    setError(null);
    startTransition(async () => {
      const result = await commitLedgerImportBatchAction(batch.id, clientId);
      if (!result.ok) setError(result.error);
    });
  };

  const onReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectLedgerImportBatchAction(batch.id, clientId);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{batch.filename}</p>
          <p className="text-muted-foreground text-xs">
            {batch.row_count} row{batch.row_count === 1 ? "" : "s"}
            {batch.flagged_count > 0 &&
              ` · ${batch.flagged_count} flagged for review`}
          </p>
        </div>
        <Badge
          variant={
            batch.status === "committed"
              ? "success"
              : batch.status === "rejected"
                ? "destructive"
                : "warning"
          }
          className="capitalize"
        >
          {batch.status === "pending" ? "Pending review" : batch.status}
        </Badge>
      </div>

      {batch.status === "pending" && (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Flag</TableHead>
                  {canCommit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.rows.map((row) => {
                  const skipped = row.status === "skipped";
                  return (
                    <TableRow key={row.id} className={skipped ? "opacity-50" : ""}>
                      <TableCell>{row.entry_date}</TableCell>
                      <TableCell className="capitalize">{row.entry_type}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.category ?? "—"}</TableCell>
                      <TableCell>{formatPeso(money(row.amount))}</TableCell>
                      <TableCell>
                        {row.flag_reason && (
                          <Badge variant="warning" className="text-xs">
                            {row.flag_reason}
                          </Badge>
                        )}
                      </TableCell>
                      {canCommit && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => onToggleSkip(row.id, skipped)}
                          >
                            {skipped ? "Include" : "Skip"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {canCommit ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={onCommit} disabled={isPending}>
                Commit {includedCount} row{includedCount === 1 ? "" : "s"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onReject}
                disabled={isPending}
              >
                Reject batch
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Waiting on Cel to review and commit this to your books.
            </p>
          )}
        </>
      )}
    </div>
  );
}
