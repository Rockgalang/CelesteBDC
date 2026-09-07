import { z } from "zod";

import { CYCLES } from "@/lib/validation/onboarding";
import { PAYMENT_METHODS } from "@/lib/validation/billing";

export const ENTITY_TYPES = [
  "sole_proprietor",
  "opc",
  "corporation",
  "partnership",
  "branch_office",
  "rep_office",
] as const;

export const TAX_TYPES = ["vat", "percentage", "exempt"] as const;

export const ENTITY_TYPE_LABELS: Record<(typeof ENTITY_TYPES)[number], string> = {
  sole_proprietor: "Sole Proprietor",
  opc: "One Person Corporation (OPC)",
  corporation: "Corporation",
  partnership: "Partnership",
  branch_office: "Branch Office",
  rep_office: "Representative Office",
};

export const TAX_TYPE_LABELS: Record<(typeof TAX_TYPES)[number], string> = {
  vat: "VAT-registered",
  percentage: "Percentage tax (non-VAT)",
  exempt: "Exempt",
};

export const registerBusinessSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name."),
  entityType: z.enum(ENTITY_TYPES),
  taxType: z.enum(TAX_TYPES),
  planCode: z.string().min(1, "Choose a plan."),
  cycle: z.enum(CYCLES),
});
export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;

export const businessDetailsSchema = z.object({
  tradeName: z.string().trim().optional(),
  tin: z.string().trim().optional(),
  rdoCode: z.string().trim().optional(),
  fiscalYearEndMonth: z.coerce.number().int().min(1).max(12),
  vatRegistered: z.boolean(),
  dtiRegNo: z.string().trim().optional(),
  secRegNo: z.string().trim().optional(),
  mayorsPermitNo: z.string().trim().optional(),
  addressLine: z.string().trim().optional(),
  barangay: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
});
export type BusinessDetailsInput = z.infer<typeof businessDetailsSchema>;

export const SALES_REPORT_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "irregular",
] as const;

export const TXN_VOLUME_RANGES = [
  "under_50",
  "50_150",
  "150_300",
  "over_300",
] as const;

export const STORE_CHANNELS = ["physical", "online", "both"] as const;

export const YES_NO_UNSURE = ["yes", "no", "not_sure"] as const;

export const REMINDER_CHANNELS = ["email", "sms", "both"] as const;

export const intakeQuestionnaireSchema = z.object({
  salesReportFrequency: z.enum(SALES_REPORT_FREQUENCIES),
  keepsDailySalesRecord: z.enum(["yes", "no", "sometimes"]),
  monthlyTxnVolume: z.enum(TXN_VOLUME_RANGES),
  issuesReceipts: z.enum(["yes", "no"]),
  storeChannel: z.enum(STORE_CHANNELS),
  hasEmployees: z.enum(["yes", "no"]),
  employeeCount: z.coerce.number().int().min(0).optional(),
  filedBirReturnsBefore: z.enum(YES_NO_UNSURE),
  hasExistingBookkeeper: z.enum(["yes", "no"]),
  biggestPainPoint: z.string().trim().max(500).optional(),
  reminderChannel: z.enum(REMINDER_CHANNELS),
});
export type IntakeQuestionnaireInput = z.infer<typeof intakeQuestionnaireSchema>;

export const MAX_QR_DATA_URL_BYTES = 500 * 1024; // ~500KB, stored inline in the DB

export const paymentChannelSchema = z.object({
  label: z.string().trim().min(1, "Give this channel a label."),
  method: z.enum(PAYMENT_METHODS),
  accountName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  qrImageDataUrl: z
    .string()
    .refine(
      (v) => !v || v.startsWith("data:image/"),
      "QR image must be an uploaded image file.",
    )
    .refine(
      (v) => !v || v.length <= MAX_QR_DATA_URL_BYTES * 1.4, // base64 overhead
      "QR image is too large (max ~500KB).",
    )
    .optional(),
  active: z.boolean(),
});
export type PaymentChannelInput = z.infer<typeof paymentChannelSchema>;
