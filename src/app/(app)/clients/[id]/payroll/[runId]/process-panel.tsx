"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { processPayrollRunAction } from "@/app/(app)/clients/[id]/payroll/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChartOfAccountsRow } from "@/lib/supabase/types";

export function ProcessPanel({
  runId,
  accounts,
}: {
  runId: string;
  accounts: ChartOfAccountsRow[];
}) {
  const router = useRouter();
  const [wages, setWages] = useState("");
  const [employerContrib, setEmployerContrib] = useState("");
  const [wht, setWht] = useState("");
  const [contributionsPayable, setContributionsPayable] = useState("");
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, startProcess] = useTransition();

  const onProcess = () => {
    setError(null);
    if (!wages || !employerContrib || !wht || !contributionsPayable || !cash) {
      setError("Choose all five accounts before processing.");
      return;
    }
    startProcess(async () => {
      const result = await processPayrollRunAction({
        payrollRunId: runId,
        wagesAccountId: wages,
        employerContribAccountId: employerContrib,
        whtPayableAccountId: wht,
        contributionsPayableAccountId: contributionsPayable,
        cashAccountId: cash,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const AccountSelect = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Process &amp; post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Posts one balanced journal entry summarizing this run and locks
          every payslip. Choose the accounts to post against — the seeded
          chart of accounts suggests 5100 (Wages), 5110 (Employer
          contributions), 2200 (Withholding tax payable), 2300
          (SSS/PhilHealth/Pag-IBIG payable), and 1010 (Cash in Bank).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountSelect label="Wages expense (debit)" value={wages} onChange={setWages} />
          <AccountSelect
            label="Employer contributions expense (debit)"
            value={employerContrib}
            onChange={setEmployerContrib}
          />
          <AccountSelect
            label="Withholding tax payable (credit)"
            value={wht}
            onChange={setWht}
          />
          <AccountSelect
            label="SSS/PhilHealth/Pag-IBIG payable (credit)"
            value={contributionsPayable}
            onChange={setContributionsPayable}
          />
          <AccountSelect label="Cash/bank (credit)" value={cash} onChange={setCash} />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button disabled={isProcessing} onClick={onProcess}>
          {isProcessing ? "Processing..." : "Process payroll run"}
        </Button>
      </CardContent>
    </Card>
  );
}
