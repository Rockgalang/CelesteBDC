"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";

import { createAdHocInvoiceAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVOICE_LINE_KINDS } from "@/lib/validation/billing";

type LineDraft = {
  kind: (typeof INVOICE_LINE_KINDS)[number];
  description: string;
  qty: string;
  unitPrice: string;
};

const EMPTY_LINE: LineDraft = {
  kind: "one_time",
  description: "",
  qty: "1",
  unitPrice: "",
};

export function NewInvoiceForm({
  clients,
  defaultClientId,
}: {
  clients: { id: string; business_name: string }[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId ?? clients[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const result = await createAdHocInvoiceAction({
        clientId,
        dueDate,
        lines: lines.map((l) => ({
          kind: l.kind,
          description: l.description,
          qty: Number(l.qty || 1),
          unitPrice: Number(l.unitPrice || 0),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/invoices/${result.invoiceId}`);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Line items</Label>
          {lines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-5">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-muted-foreground text-xs">Description</Label>
                <Input
                  value={line.description}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)),
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Kind</Label>
                <Select
                  value={line.kind}
                  onValueChange={(v) =>
                    setLines((ls) =>
                      ls.map((l, j) =>
                        j === i ? { ...l, kind: v as LineDraft["kind"] } : l,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_LINE_KINDS.map((k) => (
                      <SelectItem key={k} value={k} className="capitalize">
                        {k.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Qty</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={line.qty}
                  onChange={(e) =>
                    setLines((ls) =>
                      ls.map((l, j) => (j === i ? { ...l, qty: e.target.value } : l)),
                    )
                  }
                />
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-muted-foreground text-xs">Unit price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((ls) =>
                        ls.map((l, j) => (j === i ? { ...l, unitPrice: e.target.value } : l)),
                      )
                    }
                  />
                </div>
                {lines.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLines((ls) => [...ls, { ...EMPTY_LINE }])}
          >
            <PlusIcon className="size-4" />
            Add line
          </Button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          disabled={isPending || !clientId || lines.some((l) => !l.description.trim())}
          onClick={onCreate}
        >
          Create draft
        </Button>
      </CardContent>
    </Card>
  );
}
