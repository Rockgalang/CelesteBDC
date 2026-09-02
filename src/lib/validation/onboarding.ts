import { z } from "zod";

export const CYCLES = ["monthly", "annual"] as const;

export const selectPlanSchema = z.object({
  clientId: z.string().uuid(),
  planId: z.string().uuid(),
  cycle: z.enum(CYCLES),
});
export type SelectPlanInput = z.infer<typeof selectPlanSchema>;

export const signEngagementLetterSchema = z.object({
  clientId: z.string().uuid(),
  signedByName: z.string().trim().min(1, "Type your full name to sign."),
});
export type SignEngagementLetterInput = z.infer<
  typeof signEngagementLetterSchema
>;
