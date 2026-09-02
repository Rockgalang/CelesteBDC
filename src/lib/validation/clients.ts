import { z } from "zod";

export const ENTITY_TYPES = [
  "sole_proprietor",
  "opc",
  "corporation",
  "partnership",
  "branch_office",
  "rep_office",
] as const;

export const TAX_TYPES = ["vat", "percentage", "exempt"] as const;

export const CLIENT_STATUSES = [
  "prospect",
  "onboarding",
  "active",
  "suspended",
  "cancelled",
] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const clientSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required."),
  tradeName: optionalText,
  entityType: z.enum(ENTITY_TYPES),
  taxType: z.enum(TAX_TYPES),
  fiscalYearEndMonth: z.coerce.number().int().min(1).max(12),
  vatRegistered: z.coerce.boolean().default(false),
  tin: optionalText,
  rdoCode: optionalText,
  dtiRegNo: optionalText,
  secRegNo: optionalText,
  mayorsPermitNo: optionalText,
  addressLine: optionalText,
  barangay: optionalText,
  city: optionalText,
  province: optionalText,
  postalCode: optionalText,
  status: z.enum(CLIENT_STATUSES),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const clientContactSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required."),
  role: optionalText,
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  phone: optionalText,
  isPrimary: z.coerce.boolean().default(false),
});
export type ClientContactInput = z.infer<typeof clientContactSchema>;
