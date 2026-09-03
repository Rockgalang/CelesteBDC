"use client";

import { useState, useTransition } from "react";

import { updatePayslipAction } from "@/app/(app)/clients/[id]/payroll/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { PayslipsRow } from "@/lib/supabase/types";

const FIELDS: { key: keyof FieldState; label: string }[] = [
  { key: "basicPay", label: "Basic" },
  { key: "overtimePay", label: "OT" },
  { key: "allowances", label: "Allowances" },
  { key: "sssEmployee", label: "SSS (EE)" },
  { key: "sssEmployer", label: "SSS (ER)" },
  { key: "philhealthEmployee", label: "PhilHealth (EE)" },
  { key: "philhealthEmployer", label: "PhilHealth (ER)" },
  { key: "pagibigEmployee", label: "Pag-IBIG (EE)" },
  { key: "pagibigEmployer", label: "Pag-IBIG (ER)" },
  { key: "withholdingTax", label: "Withholding tax" },
  { key: "otherDeductions", label: "Other deductions" },
];

type FieldState = {
  basicPay: string;
  overtimePay: string;
  allowances: string;
  sssEmployee: string;
  sssEmployer: string;
  philhealthEmployee: string;
  philhealthEmployer: string;
  pagibigEmployee: string;
  pagibigEmployer: string;
  withholdingTax: string;
  otherDeductions: string;
};

export function PayslipRow({
  clientId,
  runId,
  payslip,
  employeeName,
  editable,
}: {
  clientId: string;
  runId: string;
  payslip: PayslipsRow;
  employeeName: string;
  editable: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<FieldState>({
    basicPay: payslip.basic_pay,
    overtimePay: payslip.overtime_pay,
    allowances: payslip.allowances,
    sssEmployee: payslip.sss_employee,
    sssEmployer: payslip.sss_employer,
    philhealthEmployee: payslip.philhealth_employee,
    philhealthEmployer: payslip.philhealth_employer,
    pagibigEmployee: payslip.pagibig_employee,
    pagibigEmployer: payslip.pagibig_employer,
    withholdingTax: payslip.withholding_tax,
    otherDeductions: payslip.other_deductions,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const result = await updatePayslipAction(clientId, runId, {
        payslipId: payslip.id,
        basicPay: Number(values.basicPay),
        overtimePay: Number(values.overtimePay),
        allowances: Number(values.allowances),
        sssEmployee: Number(values.sssEmployee),
        sssEmployer: Number(values.sssEmployer),
        philhealthEmployee: Number(values.philhealthEmployee),
        philhealthEmployer: Number(values.philhealthEmployer),
        pagibigEmployee: Number(values.pagibigEmployee),
        pagibigEmployer: Number(values.pagibigEmployer),
        withholdingTax: Number(values.withholdingTax),
        otherDeductions: Number(values.otherDeductions),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setExpanded(false);
    });
  };

  return (
    <div className="space-y-2 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium">{employeeName}</span>
          <span className="text-muted-foreground ml-2">
            Gross {formatPeso(money(payslip.gross_pay))} · Net{" "}
            {formatPeso(money(payslip.net_pay))}
          </span>
        </div>
        {editable && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Close" : "Edit"}
          </Button>
        )}
      </div>

      {expanded && editable && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-muted-foreground text-xs">
                  {f.label}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button size="sm" disabled={isSaving} onClick={onSave}>
            {isSaving ? "Saving..." : "Save payslip"}
          </Button>
        </div>
      )}
    </div>
  );
}
