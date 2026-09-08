"use client";

import { useState, useTransition } from "react";

import {
  createExtraRegistrationRequestAction,
  declineExtraRegistrationRequestAction,
  quoteExtraRegistrationRequestAction,
  respondExtraRegistrationRequestAction,
} from "@/lib/registrations/extra-requests-actions";
import { COMMON_EXTRA_REGISTRATIONS } from "@/lib/validation/extra-registrations";
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
import { Textarea } from "@/components/ui/textarea";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type {
  ExtraRegistrationRequestsRow,
  ExtraRegistrationStatus,
} from "@/lib/supabase/types";

const STATUS_VARIANT: Record<
  ExtraRegistrationStatus,
  "secondary" | "success" | "warning" | "destructive"
> = {
  pending: "secondary",
  quoted: "warning",
  accepted: "success",
  declined: "destructive",
};

const STATUS_LABEL: Record<ExtraRegistrationStatus, string> = {
  pending: "Awaiting quote",
  quoted: "Quote sent",
  accepted: "Accepted",
  declined: "Declined",
};

export function ExtraRegistrationRequestsPanel({
  clientId,
  canManage,
  requests,
}: {
  clientId: string;
  canManage: boolean;
  requests: ExtraRegistrationRequestsRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extra registrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Registrations outside the standard package — PhilGEPS, PhilHealth
          employer registration, and similar. These are billed separately
          once a fee is quoted and accepted, never bundled into the
          subscription.
        </p>

        {!canManage && <NewRequestForm clientId={clientId} />}

        {requests.length > 0 ? (
          <div className="space-y-2 border-t pt-4">
            {requests.map((request) =>
              canManage ? (
                <AdminRequestRow key={request.id} clientId={clientId} request={request} />
              ) : (
                <ClientRequestRow key={request.id} clientId={clientId} request={request} />
              ),
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No extra registration requests yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NewRequestForm({ clientId }: { clientId: string }) {
  const [label, setLabel] = useState<string>(COMMON_EXTRA_REGISTRATIONS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCustom = label === "other";

  const onSubmit = () => {
    setError(null);
    setSubmitted(false);
    const finalLabel = isCustom ? customLabel.trim() : label;
    startTransition(async () => {
      const result = await createExtraRegistrationRequestAction({
        clientId,
        label: finalLabel,
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCustomLabel("");
      setNote("");
      setSubmitted(true);
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>What do you need registered?</Label>
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_EXTRA_REGISTRATIONS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
              <SelectItem value="other">Other (describe below)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isCustom && (
          <div className="space-y-1.5">
            <Label htmlFor="customLabel">Describe it</Label>
            <Input
              id="customLabel"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Import Clearance Certificate"
            />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Notes (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any deadline or detail we should know?"
          rows={2}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {submitted && (
        <p className="text-sm text-emerald-600">
          Sent — Cel will follow up with a quote.
        </p>
      )}
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={isPending || (isCustom && !customLabel.trim())}
      >
        Send request
      </Button>
    </div>
  );
}

function ClientRequestRow({
  clientId,
  request,
}: {
  clientId: string;
  request: ExtraRegistrationRequestsRow;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRespond = (accept: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await respondExtraRegistrationRequestAction(
        clientId,
        request.id,
        accept,
      );
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-1.5 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{request.label}</p>
        <Badge variant={STATUS_VARIANT[request.status]}>
          {STATUS_LABEL[request.status]}
        </Badge>
      </div>
      {request.note && <p className="text-muted-foreground">{request.note}</p>}
      {request.status === "quoted" && (
        <div className="space-y-2 border-t pt-2">
          <p>
            Quoted fee: <strong>{formatPeso(money(request.quoted_fee ?? "0"))}</strong>
          </p>
          {request.quoted_note && (
            <p className="text-muted-foreground">{request.quoted_note}</p>
          )}
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => onRespond(true)}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => onRespond(false)}
            >
              Decline
            </Button>
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Requested {formatManila(request.created_at)}
      </p>
    </div>
  );
}

function AdminRequestRow({
  clientId,
  request,
}: {
  clientId: string;
  request: ExtraRegistrationRequestsRow;
}) {
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onQuote = () => {
    setError(null);
    startTransition(async () => {
      const result = await quoteExtraRegistrationRequestAction(clientId, {
        requestId: request.id,
        fee: Number(fee),
        note: note.trim() || undefined,
      });
      if (!result.ok) setError(result.error);
    });
  };

  const onDecline = () => {
    setError(null);
    startTransition(async () => {
      const result = await declineExtraRegistrationRequestAction(clientId, {
        requestId: request.id,
        note: note.trim() || undefined,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-1.5 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{request.label}</p>
        <Badge variant={STATUS_VARIANT[request.status]}>
          {STATUS_LABEL[request.status]}
        </Badge>
      </div>
      {request.note && <p className="text-muted-foreground">{request.note}</p>}
      <p className="text-muted-foreground text-xs">
        Requested {formatManila(request.created_at)}
      </p>

      {request.status === "pending" && (
        <div className="space-y-2 border-t pt-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`fee-${request.id}`}>Quoted fee</Label>
              <Input
                id={`fee-${request.id}`}
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor={`note-${request.id}`}>Note to client</Label>
              <Input
                id={`note-${request.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What the fee covers"
              />
            </div>
          </div>
          {error && <p className="text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending || !fee}
              onClick={onQuote}
            >
              Send quote
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={onDecline}>
              Decline
            </Button>
          </div>
        </div>
      )}

      {request.status === "quoted" && (
        <p className="text-muted-foreground border-t pt-2">
          Quoted {formatPeso(money(request.quoted_fee ?? "0"))} — waiting on
          the client to accept or decline.
        </p>
      )}
    </div>
  );
}
