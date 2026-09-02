import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "receipt",
  "government_id",
  "registration_certificate",
  "permit",
  "engagement_letter",
  "financial_statement",
  "payment_proof",
  "other",
] as const;

export const uploadDocumentSchema = z.object({
  clientId: z.string().uuid(),
  category: z.enum(DOCUMENT_CATEGORIES),
  issuedDate: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
