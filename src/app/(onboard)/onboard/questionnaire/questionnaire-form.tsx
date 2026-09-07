"use client";

import { useState, useTransition } from "react";

import { saveIntakeQuestionnaireAction } from "@/app/(onboard)/onboard/actions";
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
import type { IntakeQuestionnaireInput } from "@/lib/validation/self-registration";

const FIELD_OPTIONS: Record<
  Exclude<keyof IntakeQuestionnaireInput, "employeeCount" | "biggestPainPoint">,
  { label: string; options: { value: string; label: string }[] }
> = {
  salesReportFrequency: {
    label: "How often do you record your sales?",
    options: [
      { value: "daily", label: "Every day" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "irregular", label: "Irregular / when I remember" },
    ],
  },
  keepsDailySalesRecord: {
    label: "Do you already keep a daily sales report?",
    options: [
      { value: "yes", label: "Yes, consistently" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "No" },
    ],
  },
  monthlyTxnVolume: {
    label: "About how many transactions do you have per month?",
    options: [
      { value: "under_50", label: "Under 50" },
      { value: "50_150", label: "50 - 150" },
      { value: "150_300", label: "150 - 300" },
      { value: "over_300", label: "Over 300" },
    ],
  },
  issuesReceipts: {
    label: "Do you currently issue official receipts or invoices?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "Not yet" },
    ],
  },
  storeChannel: {
    label: "Where do you sell?",
    options: [
      { value: "physical", label: "Physical store only" },
      { value: "online", label: "Online only" },
      { value: "both", label: "Both" },
    ],
  },
  hasEmployees: {
    label: "Do you currently have any employees?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, just me (for now)" },
    ],
  },
  filedBirReturnsBefore: {
    label: "Have you filed BIR returns before?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  hasExistingBookkeeper: {
    label: "Do you have an existing bookkeeper or accountant?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  reminderChannel: {
    label: "How should we remind you about deadlines?",
    options: [
      { value: "email", label: "Email" },
      { value: "sms", label: "SMS" },
      { value: "both", label: "Both" },
    ],
  },
};

const DEFAULTS: IntakeQuestionnaireInput = {
  salesReportFrequency: "weekly",
  keepsDailySalesRecord: "sometimes",
  monthlyTxnVolume: "under_50",
  issuesReceipts: "no",
  storeChannel: "physical",
  hasEmployees: "no",
  employeeCount: undefined,
  filedBirReturnsBefore: "not_sure",
  hasExistingBookkeeper: "no",
  biggestPainPoint: "",
  reminderChannel: "email",
};

export function QuestionnaireForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IntakeQuestionnaireInput>(DEFAULTS);

  const set = <K extends keyof IntakeQuestionnaireInput>(
    key: K,
    value: IntakeQuestionnaireInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveIntakeQuestionnaireAction(form);
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sales & transactions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(
            [
              "salesReportFrequency",
              "keepsDailySalesRecord",
              "monthlyTxnVolume",
              "issuesReceipts",
              "storeChannel",
            ] as const
          ).map((key) => (
            <QuestionSelect
              key={key}
              fieldKey={key}
              value={form[key]}
              onChange={(v) => set(key, v as never)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business & compliance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <QuestionSelect
            fieldKey="hasEmployees"
            value={form.hasEmployees}
            onChange={(v) => set("hasEmployees", v as never)}
          />
          {form.hasEmployees === "yes" && (
            <div className="space-y-1.5">
              <Label htmlFor="employee-count">How many employees?</Label>
              <Input
                id="employee-count"
                type="number"
                min={0}
                value={form.employeeCount ?? ""}
                onChange={(e) =>
                  set(
                    "employeeCount",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </div>
          )}
          <QuestionSelect
            fieldKey="filedBirReturnsBefore"
            value={form.filedBirReturnsBefore}
            onChange={(v) => set("filedBirReturnsBefore", v as never)}
          />
          <QuestionSelect
            fieldKey="hasExistingBookkeeper"
            value={form.hasExistingBookkeeper}
            onChange={(v) => set("hasExistingBookkeeper", v as never)}
          />
          <QuestionSelect
            fieldKey="reminderChannel"
            value={form.reminderChannel}
            onChange={(v) => set("reminderChannel", v as never)}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pain-point">
              What&apos;s your biggest bookkeeping or compliance headache?
              (optional)
            </Label>
            <Textarea
              id="pain-point"
              value={form.biggestPainPoint}
              onChange={(e) => set("biggestPainPoint", e.target.value)}
              placeholder="e.g. I never know which deadlines apply to me"
            />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={onSubmit} disabled={isPending}>
        {isPending ? "Saving..." : "Finish setup"}
      </Button>
    </div>
  );
}

function QuestionSelect({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: keyof typeof FIELD_OPTIONS;
  value: string;
  onChange: (value: string) => void;
}) {
  const field = FIELD_OPTIONS[fieldKey];
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
