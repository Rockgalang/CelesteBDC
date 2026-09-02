"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  closePeriodAction,
  reopenPeriodAction,
} from "@/app/(app)/clients/[id]/accounting/financials/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountingPeriodsRow } from "@/lib/supabase/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function PeriodPanel({
  clientId,
  period: initialPeriod,
  periods,
  isOwner,
}: {
  clientId: string;
  period: string;
  periods: AccountingPeriodsRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(initialPeriod || currentMonth());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isClosing, startClose] = useTransition();
  const [isReopening, startReopen] = useTransition();

  const onPeriodChange = (value: string) => {
    setPeriod(value);
    router.push(
      `/clients/${clientId}/accounting/financials?period=${value}`,
    );
  };

  const status = periods.find((p) => p.period === period)?.status ?? "open";

  const onClose = () => {
    setError(null);
    startClose(async () => {
      const result = await closePeriodAction({ clientId, period });
      if (!result.ok) setError(result.error);
    });
  };

  const onReopen = () => {
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required to reopen a period.");
      return;
    }
    startReopen(async () => {
      const result = await reopenPeriodAction({ clientId, period, reason });
      if (!result.ok) setError(result.error);
      else setReason("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Period</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="period">Month</Label>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
            />
          </div>
          <Badge variant={status === "open" ? "secondary" : "success"}>
            {status}
          </Badge>
          {status === "open" ? (
            <Button size="sm" disabled={isClosing} onClick={onClose}>
              {isClosing ? "Closing..." : "Close period"}
            </Button>
          ) : isOwner ? (
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="reopen-reason">Reason to reopen</Label>
                <Input
                  id="reopen-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isReopening}
                onClick={onReopen}
              >
                {isReopening ? "Reopening..." : "Reopen"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Only the owner can reopen a closed period.
            </p>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <p className="text-muted-foreground text-xs">
          Statements below reflect this month and everything before it.
        </p>
      </CardContent>
    </Card>
  );
}
