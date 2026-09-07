"use client";

import { useState, useTransition } from "react";

import {
  createPaymentChannelAction,
  updatePaymentChannelAction,
} from "@/app/(app)/settings/payment-channels/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS } from "@/lib/validation/billing";
import { MAX_QR_DATA_URL_BYTES } from "@/lib/validation/self-registration";
import type { PaymentChannelsRow } from "@/lib/supabase/types";

export function PaymentChannelEditor({
  channel,
}: {
  channel: PaymentChannelsRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState(channel?.label ?? "GCash");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>(
    channel?.method ?? "gcash",
  );
  const [accountName, setAccountName] = useState(channel?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    channel?.account_number ?? "",
  );
  const [instructions, setInstructions] = useState(channel?.instructions ?? "");
  const [qrImageDataUrl, setQrImageDataUrl] = useState(
    channel?.qr_image_data_url ?? "",
  );
  const [active, setActive] = useState(channel?.active ?? true);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_QR_DATA_URL_BYTES) {
      setError("QR image is too large (max 500KB). Try a smaller screenshot.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setQrImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const input = {
        label,
        method,
        accountName,
        accountNumber,
        instructions,
        qrImageDataUrl,
        active,
      };
      const result = channel
        ? await updatePaymentChannelAction(channel.id, input)
        : await createPaymentChannelAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{channel ? channel.label : "Add a payment channel"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
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
            <Label>Account name</Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Real GCash account name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account / GCash number</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="09XX-XXX-XXXX"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Instructions shown to clients (optional)</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Send the exact invoice amount and keep your reference number."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Real GCash QR screenshot (optional, max 500KB)</Label>
          {qrImageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- inline preview of a locally-read data URL
            <img
              src={qrImageDataUrl}
              alt="QR preview"
              className="h-32 w-32 rounded-md border object-contain"
            />
          )}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`active-${channel?.id ?? "new"}`}
            checked={active}
            onCheckedChange={(c) => setActive(c === true)}
          />
          <Label htmlFor={`active-${channel?.id ?? "new"}`} className="font-normal">
            Visible to clients
          </Label>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-600">Saved.</p>
        )}
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          {isPending ? "Saving..." : channel ? "Save changes" : "Add channel"}
        </Button>
      </CardContent>
    </Card>
  );
}
