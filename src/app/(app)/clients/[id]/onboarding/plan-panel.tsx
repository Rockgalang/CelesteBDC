"use client";

import { useState, useTransition } from "react";

import { selectPlanAction } from "@/app/(app)/clients/[id]/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { CYCLES } from "@/lib/validation/onboarding";
import type { PlansRow, SubscriptionsRow } from "@/lib/supabase/types";

export function PlanPanel({
  clientId,
  plans,
  subscription,
}: {
  clientId: string;
  plans: PlansRow[];
  subscription: SubscriptionsRow | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [cycle, setCycle] = useState<string>("monthly");

  if (subscription) {
    const plan = plans.find((p) => p.id === subscription.plan_id);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">
            {plan?.name ?? "Unknown plan"} ({subscription.cycle})
          </p>
          <p className="text-muted-foreground">
            {formatPeso(
              money(
                subscription.locked_price ??
                  (subscription.cycle === "annual"
                    ? (plan?.price_annual_monthly ?? "0")
                    : (plan?.price_monthly ?? "0")),
              ),
            )}
            /month
            {subscription.price_locked_until &&
              ` · price locked until ${subscription.price_locked_until}`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Plan selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycle} onValueChange={setCycle}>
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
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          size="sm"
          disabled={isPending || !planId}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await selectPlanAction({
                clientId,
                planId,
                cycle: cycle as (typeof CYCLES)[number],
              });
              if (!result.ok) setError(result.error);
            })
          }
        >
          {isPending ? "Saving..." : "Confirm plan"}
        </Button>
      </CardContent>
    </Card>
  );
}
