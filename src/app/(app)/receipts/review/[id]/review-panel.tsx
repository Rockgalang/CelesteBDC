"use client";

import { useEffect, useState, useTransition } from "react";

import {
  approveReceiptAction,
  markReceiptDuplicateAction,
  rejectReceiptAction,
  updateReceiptFieldsAction,
} from "@/app/(app)/receipts/review/actions";
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
import { getSignedReceiptUrlAction } from "@/lib/receipts/actions";
import type { ChartOfAccountsRow, ReceiptsRow } from "@/lib/supabase/types";

export function ReviewPanel({
  receipt,
  accounts,
  duplicateOf,
}: {
  receipt: ReceiptsRow;
  accounts: ChartOfAccountsRow[];
  duplicateOf: { id: string; vendor_name: string | null } | null;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState(receipt.vendor_name ?? "");
  const [receiptDate, setReceiptDate] = useState(receipt.receipt_date ?? "");
  const [amount, setAmount] = useState(receipt.amount ?? "");
  const [category, setCategory] = useState(receipt.category ?? "");
  const [debitAccountId, setDebitAccountId] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isApproving, startApprove] = useTransition();
  const [isRejecting, startReject] = useTransition();
  const [isMarkingDup, startMarkDup] = useTransition();

  useEffect(() => {
    getSignedReceiptUrlAction(receipt.id).then((result) => {
      if (result.ok && result.url) setImageUrl(result.url);
    });
  }, [receipt.id]);

  const onSaveFields = () => {
    setError(null);
    startSave(async () => {
      const result = await updateReceiptFieldsAction({
        receiptId: receipt.id,
        vendorName: vendorName || undefined,
        receiptDate: receiptDate || undefined,
        amount: amount ? Number(amount) : undefined,
        category: category || undefined,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const onApprove = () => {
    setError(null);
    if (!debitAccountId || !creditAccountId) {
      setError("Choose both a debit and a credit account.");
      return;
    }
    startApprove(async () => {
      const result = await approveReceiptAction({
        receiptId: receipt.id,
        debitAccountId,
        creditAccountId,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const onReject = () => {
    setError(null);
    if (!rejectReason.trim()) {
      setError("A reason is required to reject.");
      return;
    }
    startReject(async () => {
      const result = await rejectReceiptAction({
        receiptId: receipt.id,
        reason: rejectReason,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const onMarkDuplicate = () => {
    if (!duplicateOf) return;
    setError(null);
    startMarkDup(async () => {
      const result = await markReceiptDuplicateAction(
        receipt.id,
        duplicateOf.id,
      );
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Receipt image</CardTitle>
        </CardHeader>
        <CardContent>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Receipt"
              className="w-full rounded-md border"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Loading image...</p>
          )}
          {receipt.ocr_error && (
            <p className="text-warning-foreground bg-warning mt-3 rounded-md p-2 text-xs">
              OCR: {receipt.ocr_error}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {duplicateOf && (
          <Card className="border-warning">
            <CardContent className="space-y-2 pt-4">
              <p className="text-sm font-medium">
                Possible duplicate of a receipt from{" "}
                {duplicateOf.vendor_name ?? "the same vendor"}.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={isMarkingDup}
                onClick={onMarkDuplicate}
              >
                {isMarkingDup ? "Marking..." : "Confirm duplicate"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Extracted details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (PHP)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={onSaveFields}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post to books</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Debit (expense/asset)</Label>
                <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit (cash/bank/payable)</Label>
                <Select
                  value={creditAccountId}
                  onValueChange={setCreditAccountId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button disabled={isApproving} onClick={onApprove}>
                {isApproving ? "Approving..." : "Approve & post"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReject((v) => !v)}
              >
                Reject
              </Button>
            </div>

            {showReject && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="reject-reason">Rejection reason</Label>
                <Input
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isRejecting}
                  onClick={onReject}
                >
                  {isRejecting ? "Rejecting..." : "Confirm reject"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />
      </div>
    </div>
  );
}
