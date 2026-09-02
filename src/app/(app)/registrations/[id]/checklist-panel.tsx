"use client";

import { useState, useTransition } from "react";

import { toggleChecklistItemAction } from "@/app/(app)/registrations/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { JobChecklistItemsRow } from "@/lib/supabase/types";

export function ChecklistPanel({
  jobId,
  items,
}: {
  jobId: string;
  items: JobChecklistItemsRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">No checklist items.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`checklist-${item.id}`}
              checked={!!item.satisfied_at}
              disabled={isPending}
              onCheckedChange={(checked) =>
                startTransition(async () => {
                  setError(null);
                  const result = await toggleChecklistItemAction(
                    item.id,
                    jobId,
                    checked === true,
                  );
                  if (!result.ok) setError(result.error);
                })
              }
            />
            <label
              htmlFor={`checklist-${item.id}`}
              className={
                item.satisfied_at ? "text-muted-foreground line-through" : ""
              }
            >
              {item.label}
            </label>
            {item.required && !item.satisfied_at && (
              <Badge variant="outline" className="ml-auto">
                Required
              </Badge>
            )}
          </div>
        ))}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
