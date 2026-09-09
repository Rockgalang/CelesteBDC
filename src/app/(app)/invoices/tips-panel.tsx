"use client";

import { useState, useTransition } from "react";

import {
  confirmTipAction,
  rejectTipAction,
  submitTipAction,
} from "@/app/(app)/invoices/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { TipsRow, TipStatus } from "@/lib/supabase/types";

const STATUS_VARIANT: Record<TipStatus, "secondary" | "success" | "destructive"> = {
  submitted: "secondary",
  confirmed: "success",
  rejected: "destructive",
};

type TipWithClient = TipsRow & { clients?: { business_name: string } | null };

export function TipsPanel({
  clientId,
  canManage,
  tips,
}: {
  clientId: string | null;
  canManage: boolean;
  tips: TipWithClient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tips</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Tips are never invoiced — they&apos;re a client&apos;s own choice,
          recorded here and booked as an expense in their books once
          confirmed.
        </p>

        {!canManage && clientId && <SendTipForm clientId={clientId} />}

        {tips.length > 0 ? (
          <ul className="space-y-2">
            {tips.map((tip) => (
              <TipRow key={tip.id} tip={tip} canManage={canManage} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No tips yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function SendTipForm({ clientId }: { clientId: string }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSend = () => {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const result = await submitTipAction({
        clientId,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setNote("");
      setSent(true);
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label>Amount</Label>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label>Note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button size="sm" disabled={isPending || !amount} onClick={onSend}>
        Send tip
      </Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
      {sent && (
        <p className="w-full text-sm text-emerald-600">
          Sent — thank you! Cel will confirm receipt.
        </p>
      )}
    </div>
  );
}

function TipRow({
  tip,
  canManage,
}: {
  tip: TipWithClient;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmTipAction(tip.id);
      if (!result.ok) setError(result.error);
    });
  };

  const onReject = () => {
    setError(null);
    startTransition(async () => {
      const result = await rejectTipAction(tip.id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="flex items-center justify-between text-sm">
      <div>
        <span className="font-medium">{formatPeso(money(tip.amount))}</span>
        {canManage && tip.clients && (
          <span className="text-muted-foreground"> · {tip.clients.business_name}</span>
        )}
        {tip.note && <span className="text-muted-foreground"> · {tip.note}</span>}
        <span className="text-muted-foreground"> · {formatManila(tip.created_at)}</span>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[tip.status]}>{tip.status}</Badge>
        {canManage && tip.status === "submitted" && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={onConfirm}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={onReject}>
              Reject
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
