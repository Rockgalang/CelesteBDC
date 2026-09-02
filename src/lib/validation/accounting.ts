import { z } from "zod";

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;
export const NORMAL_BALANCES = ["debit", "credit"] as const;

export const createAccountSchema = z.object({
  clientId: z.string().uuid(),
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
  type: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const BANK_ACCOUNT_MAX_LAST4 = 4;

export const createBankAccountSchema = z.object({
  clientId: z.string().uuid(),
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountName: z.string().trim().min(1, "Account name is required."),
  accountNumberLast4: z
    .string()
    .trim()
    .max(BANK_ACCOUNT_MAX_LAST4)
    .optional()
    .transform((v) => (v ? v : undefined)),
  glAccountId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

export const bankTransactionCsvRowSchema = z.object({
  txnDate: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number(),
  externalRef: z.string().optional(),
});
export type BankTransactionCsvRow = z.infer<typeof bankTransactionCsvRowSchema>;

export const closePeriodSchema = z.object({
  clientId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM."),
});
export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;

export const reopenPeriodSchema = z.object({
  clientId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM."),
  reason: z.string().trim().min(1, "A reason is required to reopen a period."),
});
export type ReopenPeriodInput = z.infer<typeof reopenPeriodSchema>;

export const MAX_RECEIPT_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export const uploadReceiptSchema = z.object({
  clientId: z.string().uuid(),
});
export type UploadReceiptInput = z.infer<typeof uploadReceiptSchema>;

export const updateReceiptFieldsSchema = z.object({
  receiptId: z.string().uuid(),
  vendorName: z.string().trim().optional(),
  receiptDate: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  category: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type UpdateReceiptFieldsInput = z.infer<
  typeof updateReceiptFieldsSchema
>;

export const approveReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
});
export type ApproveReceiptInput = z.infer<typeof approveReceiptSchema>;

export const rejectReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  reason: z.string().trim().min(1, "A reason is required."),
});
export type RejectReceiptInput = z.infer<typeof rejectReceiptSchema>;
