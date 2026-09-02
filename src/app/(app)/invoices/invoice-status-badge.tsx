import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/lib/supabase/types";

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  draft: "outline",
  issued: "secondary",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  void: "outline",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
