"use client";

import { useMemo, useState, useTransition } from "react";

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
import { money, ZERO } from "@/lib/money";
import type { PaymentChannelsRow, PaymentsRow } from "@/lib/supabase/types";

const STATUS_VARIANT = {
  submitted: "secondary",
  confirmed: "success",
  rejected: "destructive",
} as const;

export function PaymentPanel({
  invoiceId,
  clientId,
  invoiceTotal,
  payments,
  channels,
  canConfirm,
  canSubmit,
}: {
  invoiceId: string;
  clientId: string;
  invoiceTotal: string;
  payments: PaymentsRow[];
  channels: PaymentChannelsRow[];
  canConfirm: boolean;
  canSubmit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);

  const remainingBalance = useMemo(() => {
    const confirmedTotal = payments
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum.plus(money(p.amount)), ZERO);
    return money(invoiceTotal).minus(confirmedTotal);
  }, [invoiceTotal, payments]);
  const fullyPaid = remainingBalance.lte(0);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const hasPendingSubmission = payments.some((p) => p.status === "submitted");

  const onSubmitPayment = () => {
    setError(null);
    if (!channelId) {
      setError("Choose which channel you paid to.");
      return;
    }
    if (!file) {
      setError("Upload your proof of payment (screenshot or photo).");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("clientId", clientId);
      formData.set("category", "payment_proof");
      const uploadResult = await uploadDocumentAction(formData);
      if (!uploadResult.ok) {
        setError(uploadResult.error);
        return;
      }

      const result = await submitPaymentAction({
        invoiceId,
        channelId,
        proofDocumentId: uploadResult.documentId!,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
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

        {fullyPaid ? (
          <p className="text-sm font-medium text-emerald-600">
            This invoice is fully paid.
          </p>
        ) : (
          canSubmit && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Balance due: {formatPeso(remainingBalance)}
                </p>
                {hasPendingSubmission && (
                  <p className="text-muted-foreground text-xs">
                    You already have a payment awaiting confirmation — you can
                    still submit another if you&apos;re paying the remaining
                    balance separately.
                  </p>
                )}
                {channels.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Payment details haven&apos;t been set up yet — contact
                    Celeste BDC for how to pay.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Pay via</Label>
                      <Select value={channelId} onValueChange={setChannelId}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedChannel && (
                      <div className="bg-muted/50 flex flex-col items-center gap-3 rounded-md border p-4 sm:flex-row sm:items-start">
                        {selectedChannel.qr_image_data_url && (
                          // eslint-disable-next-line @next/next/no-img-element -- inline data URL, next/image can't optimize it
                          <img
                            src={selectedChannel.qr_image_data_url}
                            alt={`${selectedChannel.label} QR code`}
                            className="h-40 w-40 shrink-0 rounded-md border object-contain"
                          />
                        )}
                        <div className="space-y-1 text-sm">
                          {selectedChannel.account_name && (
                            <p>
                              <span className="text-muted-foreground">
                                Account name:
                              </span>{" "}
                              <span className="font-medium">
                                {selectedChannel.account_name}
                              </span>
                            </p>
                          )}
                          {selectedChannel.account_number && (
                            <p>
                              <span className="text-muted-foreground">
                                Number:
                              </span>{" "}
                              <span className="font-medium">
                                {selectedChannel.account_number}
                              </span>
                            </p>
                          )}
                          {selectedChannel.instructions && (
                            <p className="text-muted-foreground">
                              {selectedChannel.instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-proof">
                        Proof of payment (screenshot or photo)
                      </Label>
                      <Input
                        id="pay-proof"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </div>
                    {error && (
                      <p className="text-destructive text-sm">{error}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={onSubmitPayment}
                      disabled={isPending}
                    >
                      {isPending ? "Submitting..." : "Submit payment"}
                    </Button>
                  </>
                )}
              </div>
            </>
          )
        )}
        {!canSubmit && !fullyPaid && error && (
          <p className="text-destructive text-sm">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
