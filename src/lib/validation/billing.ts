import { z } from "zod";

export const PAYMENT_METHODS = [
  "gcash",
  "bank_transfer",
  "cash",
  "other",
] as const;

export const submitPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().optional(),
  proofDocumentId: z.string().uuid().optional(),
});
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
