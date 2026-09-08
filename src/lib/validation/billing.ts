import { z } from "zod";

export const PAYMENT_METHODS = [
  "gcash",
  "bank_transfer",
  "cash",
  "other",
] as const;

export const submitPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  channelId: z.string().uuid("Choose which channel you paid to."),
  proofDocumentId: z.string().uuid("Upload your proof of payment."),
});
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
