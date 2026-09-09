"use client";

import { useRef, useState, useTransition } from "react";

import { addReceiptLineItemAction } from "@/app/(app)/receipts/review/actions";
import { uploadReceiptAction, uploadReceiptImageAction } from "@/lib/receipts/actions";
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
import { formatManila } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import { formatPeso } from "@/lib/format";
import type { ReceiptsRow, ReceiptStatus } from "@/lib/supabase/types";

const STATUS_VARIANT: Record<
  ReceiptStatus,
  "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  uploaded: "secondary",
  processing: "secondary",
  ocr_failed: "warning",
  needs_review: "warning",
  approved: "success",
  rejected: "destructive",
  duplicate: "outline",
};

const STATUS_LABEL: Record<ReceiptStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ocr_failed: "Needs manual entry",
  needs_review: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

export function ReceiptsPanel({
  clientId,
  receipts,
}: {
  clientId: string;
  receipts: ReceiptsRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"sale" | "expense">("expense");
  const [files, setFiles] = useState<File[]>([]);
  const [breakdown, setBreakdown] = useState<
    { description: string; amount: string; category: string }[]
  >([]);

  const onUpload = () => {
    setError(null);
    if (files.length === 0) {
      setError("Choose at least one photo.");
      return;
    }
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", files[0]);
      formData.set("clientId", clientId);
      formData.set("entryType", entryType);
      const result = await uploadReceiptAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      for (const extra of files.slice(1)) {
        const extraForm = new FormData();
        extraForm.set("file", extra);
        await uploadReceiptImageAction(result.receiptId!, clientId, extraForm);
      }

      for (const line of breakdown) {
        if (!line.description.trim() || !line.amount) continue;
        await addReceiptLineItemAction({
          receiptId: result.receiptId!,
          description: line.description,
          amount: Number(line.amount),
          category: line.category || undefined,
        });
      }

      formRef.current?.reset();
      setFiles([]);
      setBreakdown([]);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            onUpload();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>This receipt is for a</Label>
            <Select
              value={entryType}
              onValueChange={(v) => setEntryType(v as "sale" | "expense")}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense / purchase</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receipt-file">Photo(s) of receipt</Label>
            <Input
              id="receipt-file"
              name="file"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              required
            />
            <p className="text-muted-foreground text-xs">
              Take a photo or choose several — one receipt can have multiple
              pages. We&apos;ll try to read the vendor, date, and amount
              automatically. Cel&apos;s team reviews every receipt before it
              posts to your books.
            </p>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              Breakdown (optional) — {entryType === "sale" ? "sale" : "expense"} must
              stay one type, but you can split the amount into multiple lines
            </p>
            {breakdown.map((line, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    setBreakdown((b) =>
                      b.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)),
                    )
                  }
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={line.amount}
                  onChange={(e) =>
                    setBreakdown((b) =>
                      b.map((l, j) => (j === i ? { ...l, amount: e.target.value } : l)),
                    )
                  }
                />
                <Input
                  placeholder="Category (optional)"
                  value={line.category}
                  onChange={(e) =>
                    setBreakdown((b) =>
                      b.map((l, j) => (j === i ? { ...l, category: e.target.value } : l)),
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setBreakdown((b) => [...b, { description: "", amount: "", category: "" }])
              }
            >
              Add another transaction field
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="sm" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload receipt"}
          </Button>
        </form>

        <Separator />

        {receipts.length > 0 ? (
          <ul className="space-y-2">
            {receipts.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {r.vendor_name ?? "(vendor unknown)"}
                    {r.receipt_date && ` · ${formatManila(r.receipt_date)}`}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {r.amount ? formatPeso(money(r.amount)) : formatPeso(ZERO)}
                    {" · uploaded "}
                    {formatManila(r.created_at)}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No receipts uploaded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
