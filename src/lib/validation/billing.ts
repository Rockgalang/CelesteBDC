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

export const INVOICE_LINE_KINDS = [
  "one_time",
  "govt_fee",
  "handling_fee",
  "adjustment",
] as const;

export const adHocInvoiceLineSchema = z.object({
  kind: z.enum(INVOICE_LINE_KINDS),
  description: z.string().trim().min(1, "Description is required."),
  qty: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
});
export type AdHocInvoiceLineInput = z.infer<typeof adHocInvoiceLineSchema>;

export const createAdHocInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  dueDate: z.string().min(1, "Due date is required."),
  lines: z.array(adHocInvoiceLineSchema).min(1, "Add at least one line."),
});
export type CreateAdHocInvoiceInput = z.infer<typeof createAdHocInvoiceSchema>;

export const submitTipSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter a tip amount."),
  note: z.string().trim().optional(),
  proofDocumentId: z.string().uuid().optional(),
});
export type SubmitTipInput = z.infer<typeof submitTipSchema>;

export const updateInvoiceLetterheadSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required."),
  logoDataUrl: z.string().trim().optional(),
  address: z.string().trim().optional(),
  footerNote: z.string().trim().optional(),
});
export type UpdateInvoiceLetterheadInput = z.infer<
  typeof updateInvoiceLetterheadSchema
>;
