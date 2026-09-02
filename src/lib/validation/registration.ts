import { z } from "zod";

export const JOB_TYPES = [
  "dti",
  "sec",
  "lgu_barangay",
  "lgu_mayors_permit",
  "lgu_zoning",
  "lgu_sanitary",
  "lgu_fire",
  "bir_registration",
  "bir_atp",
  "bir_books",
  "sec_gis",
] as const;

export const JOB_TYPE_LABELS: Record<(typeof JOB_TYPES)[number], string> = {
  dti: "DTI Business Name",
  sec: "SEC Registration",
  lgu_barangay: "Barangay Clearance",
  lgu_mayors_permit: "Mayor's / Business Permit",
  lgu_zoning: "Zoning Clearance",
  lgu_sanitary: "Sanitary Permit",
  lgu_fire: "Fire Safety Inspection Certificate",
  bir_registration: "BIR Registration",
  bir_atp: "BIR Authority to Print",
  bir_books: "BIR Books of Accounts",
  sec_gis: "SEC General Information Sheet",
};

export const createJobSchema = z.object({
  clientId: z.string().uuid(),
  jobType: z.enum(JOB_TYPES),
  isRenewal: z.coerce.boolean().default(false),
  targetDate: z.string().optional(),
  notes: z.string().trim().optional(),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const governmentFeeSchema = z.object({
  jobId: z.string().uuid(),
  agency: z.string().trim().min(1, "Agency is required."),
  description: z.string().trim().min(1, "Description is required."),
  amountAtCost: z.coerce.number().nonnegative(),
  handlingFee: z.coerce.number().nonnegative().default(200),
});
export type GovernmentFeeInput = z.infer<typeof governmentFeeSchema>;
