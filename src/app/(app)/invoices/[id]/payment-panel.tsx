"use client";

import { useState, useTransition } from "react";

import {
  confirmPaymentAction,
  rejectPaymentAction,
  submitPaymentAction,
} from "@/app/(app)/invoices/actions";
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
import { uploadDocumentAction } from "@/lib/documents/actions";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/validation/billing";
import type { PaymentsRow } from "@/lib/supabase/types";

const STATUS_VARIANT = {
  submitted: "secondary",
  confirmed: "success",
  rejected: "destructive",
} as const;

export function PaymentPanel({
  invoiceId,
  clientId,
  payments,
  canConfirm,
  canSubmit,
}: {
  invoiceId: string;
  clientId: string;
  payments: PaymentsRow[];
  canConfirm: boolean;
  canSubmit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("gcash");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const onSubmitPayment = () => {
    setError(null);
    if (!amount) {
      setError("Enter the amount you paid.");
      return;
    }
    startTransition(async () => {
      let proofDocumentId: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("clientId", clientId);
        formData.set("category", "payment_proof");
        const uploadResult = await uploadDocumentAction(formData);
        if (!uploadResult.ok) {
          setError(uploadResult.error);
          return;
        }
        proofDocumentId = uploadResult.documentId;
      }

      const result = await submitPaymentAction({
        invoiceId,
        amount: Number(amount),
        method: method as (typeof PAYMENT_METHODS)[number],
        reference: reference || undefined,
        proofDocumentId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setReference("");
      setFile(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {payments.length > 0 ? (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">
                    {formatPeso(money(p.amount))}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.method.replace("_", " ")}
                    {p.reference && ` · ${p.reference}`}
                    {p.paid_at && ` · ${formatManila(p.paid_at)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                  {canConfirm && p.status === "submitted" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            setError(null);
                            const result = await confirmPaymentAction(
                              p.id,
                              invoiceId,
                            );
                            if (!result.ok) setError(result.error);
                          })
                        }
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            setError(null);
                            const result = await rejectPaymentAction(
                              p.id,
                              invoiceId,
                            );
                            if (!result.ok) setError(result.error);
                          })
                        }
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No payments submitted yet.
          </p>
        )}

        {canSubmit && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">Submit proof of payment</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount">Amount paid (₱)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m} className="capitalize">
                          {m.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-reference">
                    Reference no. (optional)
                  </Label>
                  <Input
                    id="pay-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-proof">
                    Screenshot / slip (optional)
                  </Label>
                  <Input
                    id="pay-proof"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button size="sm" onClick={onSubmitPayment} disabled={isPending}>
                {isPending ? "Submitting..." : "Submit payment"}
              </Button>
            </div>
          </>
        )}
        {!canSubmit && error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
