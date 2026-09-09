"use client";

import { useState, useTransition } from "react";

import { updatePayrollStandardsAction } from "@/app/(app)/clients/[id]/payroll/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PayrollStandardsRow } from "@/lib/supabase/types";

export function PayrollStandardsPanel({
  standards,
}: {
  standards: PayrollStandardsRow;
}) {
  const [values, setValues] = useState({
    overtimeMultiplier: standards.overtime_multiplier,
    nightDifferentialRate: standards.night_differential_rate,
    lateDeductionPerMinute: standards.late_deduction_per_minute,
    absenceDeductionPerDayMultiplier: standards.absence_deduction_per_day_multiplier,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePayrollStandardsAction({
        overtimeMultiplier: Number(values.overtimeMultiplier),
        nightDifferentialRate: Number(values.nightDifferentialRate),
        lateDeductionPerMinute: Number(values.lateDeductionPerMinute),
        absenceDeductionPerDayMultiplier: Number(
          values.absenceDeductionPerDayMultiplier,
        ),
      });
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
        <CardTitle>Payroll standards</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          The rates used to turn recorded attendance (lates, absences,
          overtime, night differential) into suggested payslip amounts.
          Working days/hours per month are fixed approximations (26 days,
          8 hours) — see{" "}
          <code className="text-xs">src/lib/payroll/computations.ts</code>{" "}
          for the exact formula.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Overtime multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={values.overtimeMultiplier}
              onChange={(e) =>
                setValues((v) => ({ ...v, overtimeMultiplier: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Night differential rate (fraction)</Label>
            <Input
              type="number"
              step="0.01"
              value={values.nightDifferentialRate}
              onChange={(e) =>
                setValues((v) => ({ ...v, nightDifferentialRate: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Late deduction per minute (PHP)</Label>
            <Input
              type="number"
              step="0.0001"
              value={values.lateDeductionPerMinute}
              onChange={(e) =>
                setValues((v) => ({ ...v, lateDeductionPerMinute: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Absence deduction (× daily rate)</Label>
            <Input
              type="number"
              step="0.01"
              value={values.absenceDeductionPerDayMultiplier}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  absenceDeductionPerDayMultiplier: e.target.value,
                }))
              }
            />
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
        <Button size="sm" disabled={isPending} onClick={onSave}>
          Save payroll standards
        </Button>
      </CardContent>
    </Card>
  );
}
