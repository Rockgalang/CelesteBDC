"use client";

import { useRef, useState, useTransition } from "react";

import { uploadReceiptAction } from "@/lib/receipts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const onUpload = (formData: FormData) => {
    setError(null);
    startUpload(async () => {
      const result = await uploadReceiptAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={onUpload} className="space-y-3">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="space-y-1.5">
            <Label htmlFor="receipt-file">Photo of receipt</Label>
            <Input
              id="receipt-file"
              name="file"
              type="file"
              accept="image/*"
              capture="environment"
              required
            />
            <p className="text-muted-foreground text-xs">
              We&apos;ll try to read the vendor, date, and amount
              automatically. Cel&apos;s team reviews every receipt before it
              posts to your books.
            </p>
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
