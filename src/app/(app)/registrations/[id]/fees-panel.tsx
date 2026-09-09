"use client";

import { useRef, useState, useTransition } from "react";

import {
  addGovernmentFeeAction,
  markFeeShoulderedAction,
  settleFeeAction,
} from "@/app/(app)/registrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { uploadDocumentAction } from "@/lib/documents/actions";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { ExtraFeeStatus, GovernmentFeesRow } from "@/lib/supabase/types";

const STATUS_VARIANT: Record<ExtraFeeStatus, "outline" | "warning" | "success"> = {
  pending: "outline",
  shouldered: "warning",
  settled: "success",
};

const STATUS_LABEL: Record<ExtraFeeStatus, string> = {
  pending: "Pending",
  shouldered: "Shouldered by Cel",
  settled: "Settled",
};

export function FeesPanel({
  jobId,
  clientId,
  fees,
}: {
  jobId: string;
  clientId: string;
  fees: GovernmentFeesRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agency, setAgency] = useState("");
  const [description, setDescription] = useState("");
  const [amountAtCost, setAmountAtCost] = useState("");
  const [handlingFee, setHandlingFee] = useState("200");

  const onSubmit = () => {
    setError(null);
    if (!agency || !description || !amountAtCost) {
      setError("Fill in agency, description, and cost.");
      return;
    }
    startTransition(async () => {
      const result = await addGovernmentFeeAction({
        jobId,
        agency,
        description,
        amountAtCost: Number(amountAtCost),
        handlingFee: Number(handlingFee || 0),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAgency("");
      setDescription("");
      setAmountAtCost("");
      setHandlingFee("200");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extra fee ledger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Every extra fee here must be settled — with a receipt on file —
          before this job can be marked completed. Cel may shoulder an
          unexpected fee mid-processing, but the client still owes it before
          documents are released.
        </p>
        {fees.length > 0 ? (
          <ul className="space-y-3">
            {fees.map((fee) => (
              <FeeRow key={fee.id} fee={fee} jobId={jobId} clientId={clientId} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No extra fees logged.
          </p>
        )}

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fee-agency">Agency</Label>
            <Input
              id="fee-agency"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="e.g. DTI, City Treasurer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-description">Description</Label>
            <Input
              id="fee-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-cost">Cost (₱)</Label>
            <Input
              id="fee-cost"
              type="number"
              step="0.01"
              value={amountAtCost}
              onChange={(e) => setAmountAtCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-handling">Handling fee (₱)</Label>
            <Input
              id="fee-handling"
              type="number"
              step="0.01"
              value={handlingFee}
              onChange={(e) => setHandlingFee(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          {isPending ? "Adding..." : "Add fee"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeeRow({
  fee,
  jobId,
  clientId,
}: {
  fee: GovernmentFeesRow;
  jobId: string;
  clientId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onShoulder = () => {
    setError(null);
    startTransition(async () => {
      const result = await markFeeShoulderedAction(fee.id, jobId);
      if (!result.ok) setError(result.error);
    });
  };

  const onSettle = (file: File | null) => {
    setError(null);
    startTransition(async () => {
      let receiptDocumentId: string | undefined;
      if (file) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("clientId", clientId);
        formData.set("category", "other");
        const uploadResult = await uploadDocumentAction(formData);
        if (!uploadResult.ok) {
          setError(uploadResult.error);
          return;
        }
        receiptDocumentId = uploadResult.documentId;
      }

      const result = await settleFeeAction(fee.id, jobId, receiptDocumentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  return (
    <li className="space-y-1.5 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{fee.agency}</span>
          <span className="text-muted-foreground"> · {fee.description}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{formatPeso(money(fee.amount_at_cost).plus(fee.handling_fee))}</span>
          <Badge variant={STATUS_VARIANT[fee.status]}>
            {STATUS_LABEL[fee.status]}
          </Badge>
          <Badge variant={fee.billed_invoice_id ? "success" : "outline"}>
            {fee.billed_invoice_id ? "Billed" : "Unbilled"}
          </Badge>
        </div>
      </div>

      {fee.status !== "settled" && (
        <div className="flex flex-wrap items-center gap-2">
          {fee.status === "pending" && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={onShoulder}>
              Cel shouldered this
            </Button>
          )}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            disabled={isPending}
            className="max-w-56 text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) onSettle(file);
            }}
          />
          {fee.receipt_document_id && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onSettle(null)}
            >
              Settle (receipt already on file)
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </li>
  );
}
