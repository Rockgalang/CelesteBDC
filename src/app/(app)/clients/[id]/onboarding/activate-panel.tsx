"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { activateClientAction } from "@/app/(app)/clients/[id]/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ActivatePanel({
  clientId,
  disabled,
  alreadyActive,
}: {
  clientId: string;
  disabled: boolean;
  alreadyActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Document collection &amp; activation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Collect required documents on the client&apos;s detail page. Target: 3
          business days from complete document submission.
        </p>
        {alreadyActive ? (
          <p className="text-success text-sm font-medium">
            This client is active.
          </p>
        ) : (
          <>
            {disabled && (
              <p className="text-muted-foreground text-xs">
                Confirm the plan and sign the engagement letter first.
              </p>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              size="sm"
              disabled={isPending || disabled}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await activateClientAction(clientId);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                })
              }
            >
              {isPending ? "Activating..." : "Activate client"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
