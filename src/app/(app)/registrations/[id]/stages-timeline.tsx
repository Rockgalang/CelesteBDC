"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";

import { advanceJobStageAction } from "@/app/(app)/registrations/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobStagesRow } from "@/lib/supabase/types";

export function StagesTimeline({
  jobId,
  stages,
  jobStatus,
}: {
  jobId: string;
  stages: JobStagesRow[];
  jobStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasInProgress = stages.some((s) => s.status === "in_progress");

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                stage.status === "completed" &&
                  "border-success bg-success text-success-foreground",
                stage.status === "in_progress" && "border-primary text-primary",
                (stage.status === "pending" || stage.status === "skipped") &&
                  "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {stage.status === "completed" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                stage.sequence
              )}
            </span>
            <span
              className={cn(
                stage.status === "in_progress" && "font-medium",
                stage.status === "pending" && "text-muted-foreground",
              )}
            >
              {stage.name}
            </span>
          </li>
        ))}
      </ol>
      {hasInProgress &&
        jobStatus !== "completed" &&
        jobStatus !== "cancelled" && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await advanceJobStageAction(jobId);
                if (!result.ok) setError(result.error);
              })
            }
          >
            {isPending ? "Advancing..." : "Advance to next stage"}
          </Button>
        )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
