"use client";

import { useState, useTransition } from "react";

import { registerBusinessAction } from "@/app/(onboard)/onboard/actions";
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
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { CYCLES } from "@/lib/validation/onboarding";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  TAX_TYPES,
  TAX_TYPE_LABELS,
} from "@/lib/validation/self-registration";
import type { PlansRow } from "@/lib/supabase/types";

export function RegisterBusinessForm({ plans }: { plans: PlansRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] =
    useState<(typeof ENTITY_TYPES)[number]>("sole_proprietor");
  const [taxType, setTaxType] = useState<(typeof TAX_TYPES)[number]>("percentage");
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? "");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>("monthly");

  const onSubmit = () => {
    setError(null);
    if (!businessName.trim()) {
      setError("Enter your business name.");
      return;
    }
    if (!planCode) {
      setError("Choose a plan.");
      return;
    }
    startTransition(async () => {
      const result = await registerBusinessAction({
        businessName,
        entityType,
        taxType,
        planCode,
        cycle,
      });
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Juan's Sari-Sari Store"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Business type</Label>
            <Select
              value={entityType}
              onValueChange={(v) => setEntityType(v as typeof entityType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTITY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tax registration</Label>
            <Select
              value={taxType}
              onValueChange={(v) => setTaxType(v as typeof taxType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TAX_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Not sure? Pick your best guess — you can correct this with us
              later.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choose a plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanCode(p.code)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  planCode === p.code
                    ? "border-primary ring-primary/30 ring-2"
                    : "hover:border-foreground/30",
                )}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(p.features as { target?: string })?.target ?? ""}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatPeso(money(p.price_monthly))}
                  <span className="text-muted-foreground text-xs font-normal">
                    {" "}
                    /mo
                  </span>
                </p>
              </button>
            ))}
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label>Billing cycle</Label>
            <Select
              value={cycle}
              onValueChange={(v) => setCycle(v as (typeof CYCLES)[number])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cycle === "annual" && (
              <p className="text-muted-foreground text-xs">
                Annual billing locks in the discounted monthly rate for 12
                months.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={onSubmit} disabled={isPending}>
        {isPending ? "Creating your account..." : "Continue to payment"}
      </Button>
    </div>
  );
}
