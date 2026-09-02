import { z } from "zod";

// Shared between the client form (react-hook-form resolver) and the server
// action that ultimately calls Supabase Auth — never trust client-side
// validation alone (build spec §3).

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type SignupInput = z.infer<typeof signupSchema>;
