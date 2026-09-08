import { z } from "zod";

/** Common asks Cel doesn't cover in the standard subscription packages —
 * shown as quick picks, but the label field stays free text so a client
 * can name anything not on this list. */
export const COMMON_EXTRA_REGISTRATIONS = [
  "PhilGEPS Registration",
  "PhilHealth Employer Registration",
  "Pag-IBIG Employer Registration",
  "SSS Employer Registration",
  "Import/Export License",
  "FDA License to Operate",
] as const;

export const createExtraRegistrationRequestSchema = z.object({
  clientId: z.string().uuid(),
  label: z.string().trim().min(1, "Tell us what you need registered."),
  note: z.string().trim().optional(),
});
export type CreateExtraRegistrationRequestInput = z.infer<
  typeof createExtraRegistrationRequestSchema
>;

export const quoteExtraRegistrationRequestSchema = z.object({
  requestId: z.string().uuid(),
  fee: z.coerce.number().positive("Quoted fee must be a positive amount."),
  note: z.string().trim().optional(),
});
export type QuoteExtraRegistrationRequestInput = z.infer<
  typeof quoteExtraRegistrationRequestSchema
>;

export const declineExtraRegistrationRequestSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().optional(),
});
export type DeclineExtraRegistrationRequestInput = z.infer<
  typeof declineExtraRegistrationRequestSchema
>;
