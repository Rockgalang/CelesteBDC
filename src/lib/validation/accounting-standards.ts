import { z } from "zod";

import { ACCOUNT_TYPES, NORMAL_BALANCES } from "@/lib/validation/accounting";

export const duplicateTemplateSetSchema = z.object({
  setId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required."),
});
export type DuplicateTemplateSetInput = z.infer<typeof duplicateTemplateSetSchema>;

export const renameTemplateSetSchema = z.object({
  setId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
});
export type RenameTemplateSetInput = z.infer<typeof renameTemplateSetSchema>;

export const setTemplateSetDefaultsSchema = z.object({
  setId: z.string().uuid(),
  entityTypes: z.array(
    z.enum([
      "sole_proprietor",
      "opc",
      "corporation",
      "partnership",
      "branch_office",
      "rep_office",
    ]),
  ),
});
export type SetTemplateSetDefaultsInput = z.infer<
  typeof setTemplateSetDefaultsSchema
>;

export const createTemplateAccountSchema = z.object({
  templateSetId: z.string().uuid(),
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
  type: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentCode: z.string().trim().optional(),
  sequence: z.coerce.number().int().default(999),
});
export type CreateTemplateAccountInput = z.infer<
  typeof createTemplateAccountSchema
>;

export const updateTemplateAccountSchema = z.object({
  templateId: z.string().uuid(),
  templateSetId: z.string().uuid(),
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
  type: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentCode: z.string().trim().optional(),
  sequence: z.coerce.number().int(),
});
export type UpdateTemplateAccountInput = z.infer<
  typeof updateTemplateAccountSchema
>;
