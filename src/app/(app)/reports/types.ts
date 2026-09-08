import type { ReceiptStatus, ReportEntryType } from "@/lib/supabase/types";

export type LedgerRow = {
  id: string;
  source: "receipt" | "manual";
  entryType: ReportEntryType;
  date: string;
  description: string;
  amount: string;
  category: string | null;
  status: ReceiptStatus | null;
};
