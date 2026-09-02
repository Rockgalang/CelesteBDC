"use client";

import { useState, useTransition } from "react";

import { addGovernmentFeeAction } from "@/app/(app)/registrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import type { GovernmentFeesRow } from "@/lib/supabase/types";

export function FeesPanel({
  jobId,
  fees,
}: {
  jobId: string;
  fees: GovernmentFeesRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agency, setAgency] = useState("");
  const [description, setDescription] = useState("");
  const [amountAtCost, setAmountAtCost] = useState("");
  const [handlingFee, setHandlingFee] = useState("200");

  const onSubmit = () => {
    setError(null);
    if (!agency || !description || !amountAtCost) {
      setError("Fill in agency, description, and cost.");
      return;
    }
    startTransition(async () => {
      const result = await addGovernmentFeeAction({
        jobId,
        agency,
        description,
        amountAtCost: Number(amountAtCost),
        handlingFee: Number(handlingFee || 0),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAgency("");
      setDescription("");
      setAmountAtCost("");
      setHandlingFee("200");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Government fee ledger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fees.length > 0 ? (
          <ul className="space-y-2">
            {fees.map((fee) => (
              <li
                key={fee.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{fee.agency}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {fee.description}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {formatPeso(
                      money(fee.amount_at_cost).plus(fee.handling_fee),
                    )}
                  </span>
                  <Badge
                    variant={fee.billed_invoice_id ? "success" : "outline"}
                  >
                    {fee.billed_invoice_id ? "Billed" : "Unbilled"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No government fees logged.
          </p>
        )}

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fee-agency">Agency</Label>
            <Input
              id="fee-agency"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="e.g. DTI, City Treasurer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-description">Description</Label>
            <Input
              id="fee-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-cost">Cost (₱)</Label>
            <Input
              id="fee-cost"
              type="number"
              step="0.01"
              value={amountAtCost}
              onChange={(e) => setAmountAtCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-handling">Handling fee (₱)</Label>
            <Input
              id="fee-handling"
              type="number"
              step="0.01"
              value={handlingFee}
              onChange={(e) => setHandlingFee(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          {isPending ? "Adding..." : "Add fee"}
        </Button>
      </CardContent>
    </Card>
  );
}
