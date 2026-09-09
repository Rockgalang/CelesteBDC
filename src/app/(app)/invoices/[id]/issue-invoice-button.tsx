"use client";

import { useState, useTransition } from "react";

import { issueInvoiceAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";

export function IssueInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onIssue = () => {
    setError(null);
    startTransition(async () => {
      const result = await issueInvoiceAction(invoiceId);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-2">
      <Button size="sm" disabled={isPending} onClick={onIssue}>
        Issue invoice
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
