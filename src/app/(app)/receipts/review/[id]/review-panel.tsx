"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  addReceiptLineItemAction,
  approveReceiptAction,
  deleteReceiptLineItemAction,
  getNextQueuedReceiptAction,
  importReceiptLineItemsCsvAction,
  markReceiptDuplicateAction,
  rejectReceiptAction,
  setReceiptLineItemAccountAction,
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
import {
  getSignedReceiptImageUrlAction,
  getSignedReceiptUrlAction,
} from "@/lib/receipts/actions";
import { formatPeso } from "@/lib/format";
import { money, ZERO } from "@/lib/money";
import type {
  ChartOfAccountsRow,
  ReceiptImagesRow,
  ReceiptLineItemsRow,
  ReceiptsRow,
} from "@/lib/supabase/types";

export function ReviewPanel({
  receipt,
  accounts,
  duplicateOf,
  images,
  lineItems,
}: {
  receipt: ReceiptsRow;
  accounts: ChartOfAccountsRow[];
  duplicateOf: { id: string; vendor_name: string | null } | null;
  images: ReceiptImagesRow[];
  lineItems: ReceiptLineItemsRow[];
}) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extraImageUrls, setExtraImageUrls] = useState<Record<string, string>>({});
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
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

  const hasLineItems = lineItems.length > 0;
  const lineItemsTotal = lineItems.reduce(
    (sum, li) => sum.plus(money(li.amount)),
    ZERO,
  );
  const amountMismatch =
    hasLineItems && amount ? !lineItemsTotal.eq(money(amount)) : false;

  useEffect(() => {
    getSignedReceiptUrlAction(receipt.id).then((result) => {
      if (result.ok && result.url) setImageUrl(result.url);
    });
    images.forEach((img) => {
      getSignedReceiptImageUrlAction(img.storage_path).then((result) => {
        if (result.ok && result.url) {
          setExtraImageUrls((prev) => ({ ...prev, [img.id]: result.url! }));
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.id]);

  const goToNext = () => {
    const next$ = getNextQueuedReceiptAction(receipt.client_id, receipt.id);
    next$.then((next) => {
      if (next) {
        router.push(`/receipts/review/${next.id}`);
      } else {
        router.push(`/receipts/review?doneClientId=${receipt.client_id}`);
      }
    });
  };

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
    if (!creditAccountId) {
      setError("Choose a credit account.");
      return;
    }
    if (!hasLineItems && !debitAccountId) {
      setError("Choose both a debit and a credit account.");
      return;
    }
    if (amountMismatch) {
      setError(
        `Line items total ${formatPeso(lineItemsTotal)} but the receipt amount is ${formatPeso(money(amount))}.`,
      );
      return;
    }
    startApprove(async () => {
      const result = await approveReceiptAction({
        receiptId: receipt.id,
        debitAccountId: hasLineItems ? undefined : debitAccountId,
        creditAccountId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goToNext();
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
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goToNext();
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
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goToNext();
    });
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            Receipt image{images.length > 0 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {imageUrl ? (
            <button type="button" onClick={() => setZoomUrl(imageUrl)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Receipt"
                className="w-full cursor-zoom-in rounded-md border"
              />
            </button>
          ) : (
            <p className="text-muted-foreground text-sm">Loading image...</p>
          )}
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => extraImageUrls[img.id] && setZoomUrl(extraImageUrls[img.id])}
            >
              {extraImageUrls[img.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={extraImageUrls[img.id]}
                  alt={`Receipt page ${img.sequence}`}
                  className="w-full cursor-zoom-in rounded-md border"
                />
              ) : (
                <p className="text-muted-foreground text-sm">Loading photo...</p>
              )}
            </button>
          ))}
          {receipt.ocr_error && (
            <p className="text-warning-foreground bg-warning rounded-md p-2 text-xs">
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

        <LineItemsPanel
          receiptId={receipt.id}
          accounts={accounts}
          lineItems={lineItems}
          amountMismatch={amountMismatch}
          lineItemsTotal={lineItemsTotal}
        />

        <Card>
          <CardHeader>
            <CardTitle>Post to books</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {!hasLineItems && (
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
              )}
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
            {hasLineItems && (
              <p className="text-muted-foreground text-xs">
                Each line item posts to its own account (set below); this
                credit account is what balances the total.
              </p>
            )}

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

      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomUrl}
            alt="Receipt zoom"
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      )}
    </div>
  );
}

function LineItemsPanel({
  receiptId,
  accounts,
  lineItems,
  amountMismatch,
  lineItemsTotal,
}: {
  receiptId: string;
  accounts: ChartOfAccountsRow[];
  lineItems: ReceiptLineItemsRow[];
  amountMismatch: boolean;
  lineItemsTotal: ReturnType<typeof money>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [csvText, setCsvText] = useState("");
  const [showCsv, setShowCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onAdd = () => {
    setError(null);
    if (!description.trim() || !itemAmount) {
      setError("Description and amount are required.");
      return;
    }
    startTransition(async () => {
      const result = await addReceiptLineItemAction({
        receiptId,
        description,
        amount: Number(itemAmount),
        category: itemCategory || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDescription("");
      setItemAmount("");
      setItemCategory("");
    });
  };

  const onDelete = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteReceiptLineItemAction(id, receiptId);
      if (!result.ok) setError(result.error);
    });
  };

  const onImportCsv = () => {
    setError(null);
    if (!csvText.trim()) return;
    startTransition(async () => {
      const result = await importReceiptLineItemsCsvAction(receiptId, csvText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCsvText("");
      setShowCsv(false);
    });
  };

  const onUploadCsv = (file: File | null) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const text = await file.text();
      const result = await importReceiptLineItemsCsvAction(receiptId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction breakdown (optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Split this receipt into multiple line items — each posts to its
          own account. Leave empty to post the whole amount as one entry.
        </p>

        {lineItems.length > 0 && (
          <ul className="space-y-2">
            {lineItems.map((li) => (
              <li key={li.id} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{li.description}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatPeso(money(li.amount))}
                    {li.category && ` · ${li.category}`}
                  </span>
                </div>
                <LineItemAccountSelect
                  lineItem={li}
                  receiptId={receiptId}
                  accounts={accounts}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => onDelete(li.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {lineItems.length > 0 && (
          <p
            className={`text-sm ${amountMismatch ? "text-destructive" : "text-muted-foreground"}`}
          >
            Line items total: {formatPeso(lineItemsTotal)}
            {amountMismatch && " — does not match the receipt amount above."}
          </p>
        )}

        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={itemAmount}
            onChange={(e) => setItemAmount(e.target.value)}
          />
          <Input
            placeholder="Category (optional)"
            value={itemCategory}
            onChange={(e) => setItemCategory(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={onAdd}
            className="sm:col-span-4"
          >
            Add another transaction field
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowCsv((v) => !v)}
        >
          {showCsv ? "Hide CSV import" : "Paste or upload CSV instead"}
        </Button>
        {showCsv && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-muted-foreground text-xs">
              Format: description,amount,category (header row optional).
            </p>
            <textarea
              className="border-input min-h-20 w-full rounded-md border bg-transparent p-2 text-sm"
              placeholder={"Office supplies,200,supplies\nTransportation,100,transport"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={isPending || !csvText.trim()} onClick={onImportCsv}>
                Import pasted rows
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={isPending}
                className="max-w-56"
                onChange={(e) => onUploadCsv(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}

function LineItemAccountSelect({
  lineItem,
  receiptId,
  accounts,
}: {
  lineItem: ReceiptLineItemsRow;
  receiptId: string;
  accounts: ChartOfAccountsRow[];
}) {
  const [accountId, setAccountId] = useState(lineItem.account_id ?? "");
  const [isPending, startTransition] = useTransition();

  const onChange = (value: string) => {
    setAccountId(value);
    startTransition(async () => {
      await setReceiptLineItemAccountAction(lineItem.id, receiptId, value);
    });
  };

  return (
    <Select value={accountId} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-40 shrink-0">
        <SelectValue placeholder="Account" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.code} — {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
