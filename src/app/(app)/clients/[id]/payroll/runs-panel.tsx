"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { createPayrollRunAction } from "@/app/(app)/clients/[id]/payroll/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatManila } from "@/lib/format";
import type { PayrollRunsRow } from "@/lib/supabase/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function RunsPanel({
  clientId,
  runs,
}: {
  clientId: string;
  runs: PayrollRunsRow[];
}) {
  const [period, setPeriod] = useState(currentMonth());
  const [payDate, setPayDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreate] = useTransition();

  const onCreate = () => {
    setError(null);
    if (!payDate) {
      setError("Choose a pay date.");
      return;
    }
    startCreate(async () => {
      const result = await createPayrollRunAction({
        clientId,
        period,
        payDate,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length > 0 ? (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/clients/${clientId}/payroll/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {r.period}
                </Link>
                <div className="flex items-center gap-2">
                  {r.pay_date && (
                    <span className="text-muted-foreground text-xs">
                      pay {formatManila(r.pay_date)}
                    </span>
                  )}
                  <Badge variant={r.status === "processed" ? "success" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No payroll runs yet.
          </p>
        )}

        <Separator />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="run-period">Period</Label>
            <Input
              id="run-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="run-pay-date">Pay date</Label>
            <Input
              id="run-pay-date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button size="sm" disabled={isCreating} onClick={onCreate}>
          {isCreating ? "Creating..." : "Create payroll run"}
        </Button>
      </CardContent>
    </Card>
  );
}
