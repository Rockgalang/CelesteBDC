"use client";

import { useMemo, useState, useTransition } from "react";

import {
  addManualLedgerEntryAction,
  deleteManualLedgerEntryAction,
  updateManualLedgerEntryAction,
} from "@/lib/ledger/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { ManualLedgerEntryInput } from "@/lib/validation/ledger";
import type { LedgerRow } from "@/app/(app)/reports/types";

const FILTERS = ["all", "sale", "expense"] as const;

const EMPTY_DRAFT: ManualLedgerEntryInput = {
  entryType: "expense",
  entryDate: new Date().toISOString().slice(0, 10),
  description: "",
  amount: 0,
  category: "",
};

function toCsv(rows: LedgerRow[]): string {
  const header = ["Date", "Type", "Description", "Category", "Amount", "Source", "Status"];
  const lines = rows.map((r) =>
    [
      r.date,
      r.entryType,
      r.description,
      r.category ?? "",
      r.amount,
      r.source,
      r.status ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(rows: LedgerRow[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `celeste-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsTable({
  rows,
  clientId,
}: {
  rows: LedgerRow[];
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draft, setDraft] = useState<ManualLedgerEntryInput>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ManualLedgerEntryInput>(EMPTY_DRAFT);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.entryType !== filter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (
        q &&
        !r.description.toLowerCase().includes(q) &&
        !(r.category ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, filter, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const sales = filteredRows
      .filter((r) => r.entryType === "sale")
      .reduce((s, r) => s.plus(money(r.amount)), money(0));
    const expenses = filteredRows
      .filter((r) => r.entryType === "expense")
      .reduce((s, r) => s.plus(money(r.amount)), money(0));
    return { sales, expenses };
  }, [filteredRows]);

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await addManualLedgerEntryAction(clientId, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(EMPTY_DRAFT);
    });
  };

  const startEdit = (row: LedgerRow) => {
    setEditingId(row.id);
    setEditDraft({
      entryType: row.entryType,
      entryDate: row.date,
      description: row.description,
      amount: Number(row.amount),
      category: row.category ?? "",
    });
  };

  const onSaveEdit = () => {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateManualLedgerEntryAction(
        editingId,
        clientId,
        editDraft,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
    });
  };

  const onDelete = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteManualLedgerEntryAction(id, clientId);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatPeso(totals.sales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatPeso(totals.expenses)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>Register</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadCsv(filteredRows)}>
              Export filtered CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadCsv(rows)}>
              Export all CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f === "all" ? "All" : f === "sale" ? "Sales" : "Expenses"}
              </Button>
            ))}
            <Input
              placeholder="Search description or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-56"
            />
            <div className="flex items-center gap-1 text-sm">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
                aria-label="From date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
                aria-label="To date"
              />
              {(dateFrom || dateTo || search) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSearch("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Input
                      type="date"
                      value={draft.entryDate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, entryDate: e.target.value }))
                      }
                      className="w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={draft.entryType}
                      onValueChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          entryType: v as "sale" | "expense",
                        }))
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Description"
                      value={draft.description}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, description: e.target.value }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Category"
                      value={draft.category}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, category: e.target.value }))
                      }
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={draft.amount || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          amount: Number(e.target.value),
                        }))
                      }
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Button size="sm" onClick={onAdd} disabled={isPending}>
                      Add
                    </Button>
                  </TableCell>
                </TableRow>

                {filteredRows.map((row) => {
                  const isEditing = editingId === row.id;
                  if (isEditing) {
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={editDraft.entryDate}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                entryDate: e.target.value,
                              }))
                            }
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editDraft.entryType}
                            onValueChange={(v) =>
                              setEditDraft((d) => ({
                                ...d,
                                entryType: v as "sale" | "expense",
                              }))
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sale">Sale</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editDraft.description}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                description: e.target.value,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editDraft.category}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                category: e.target.value,
                              }))
                            }
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={editDraft.amount || ""}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                amount: Number(e.target.value),
                              }))
                            }
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell />
                        <TableCell className="space-x-1">
                          <Button size="sm" onClick={onSaveEdit} disabled={isPending}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="capitalize">{row.entryType}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.category ?? "—"}</TableCell>
                      <TableCell>{formatPeso(money(row.amount))}</TableCell>
                      <TableCell>
                        {row.status ? (
                          <Badge variant="secondary" className="capitalize">
                            {row.status.replace("_", " ")}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {row.source === "manual" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(row.id)}
                              disabled={isPending}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {filteredRows.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No entries yet — upload a receipt or add one above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
