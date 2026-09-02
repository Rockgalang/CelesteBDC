"use client";

import { useState, useTransition } from "react";

import { claimOwnerAction } from "@/app/(app)/setup/actions";
import { Button } from "@/components/ui/button";

export function ClaimOwnerButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="text-success text-sm">
        You&apos;re now the owner. Reload the app to see the Ops Cockpit.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await claimOwnerAction();
            if (!result.ok) setError(result.error);
            else setDone(true);
          })
        }
      >
        {isPending ? "Claiming..." : "Claim owner role"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
