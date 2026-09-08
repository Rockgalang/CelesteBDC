import { z } from "zod";

export const REPORT_ENTRY_TYPES = ["sale", "expense"] as const;

export const manualLedgerEntrySchema = z.object({
  entryType: z.enum(REPORT_ENTRY_TYPES),
  entryDate: z.string().min(1, "Pick a date."),
  description: z.string().trim().min(1, "Enter a description."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  category: z.string().trim().optional(),
});
export type ManualLedgerEntryInput = z.infer<typeof manualLedgerEntrySchema>;
