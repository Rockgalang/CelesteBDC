"use client";

import { useState, useTransition } from "react";

import { signEngagementLetterAction } from "@/app/(app)/clients/[id]/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatManila } from "@/lib/format";
import type { EngagementLettersRow } from "@/lib/supabase/types";

const PLACEHOLDER_TEXT = `This Engagement Letter is a placeholder pending final legal copy
(build spec, open item #4). By signing below, the signatory acknowledges
that Celeste Business Development Center will provide business
registration, tax compliance, bookkeeping, and/or payroll services as
selected in the client's plan, and agrees to the pricing and scope
communicated at signup. Celeste BDC is not a CPA firm; financial
statements it produces are compiled management accounts, not audited
statements. This placeholder text must be replaced with reviewed legal
copy before this flow is used with a real client.`;

export function EngagementLetterPanel({
  clientId,
  existingLetter,
  disabled,
}: {
  clientId: string;
  existingLetter: EngagementLettersRow | null;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  if (existingLetter) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>2. Engagement letter</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Signed by {existingLetter.signed_by_name} on{" "}
          {formatManila(existingLetter.signed_at, "MMM d, yyyy h:mm a")}{" "}
          (template {existingLetter.template_version}).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Engagement letter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/30 text-muted-foreground max-h-40 overflow-y-auto rounded-md border p-3 text-xs whitespace-pre-line">
          {PLACEHOLDER_TEXT}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signature-name">Type your full name to sign</Label>
          <Input
            id="signature-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
          />
        </div>
        {disabled && (
          <p className="text-muted-foreground text-xs">
            Confirm the plan first.
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          size="sm"
          disabled={isPending || disabled || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await signEngagementLetterAction({
                clientId,
                signedByName: name,
              });
              if (!result.ok) setError(result.error);
            })
          }
        >
          {isPending ? "Signing..." : "Sign and accept"}
        </Button>
      </CardContent>
    </Card>
  );
}
