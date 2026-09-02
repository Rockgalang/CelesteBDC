"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  LoginInput,
  MagicLinkInput,
  SignupInput,
} from "@/lib/validation/auth";
import {
  loginSchema,
  magicLinkSchema,
  signupSchema,
} from "@/lib/validation/auth";

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: "Incorrect email or password." };
  }

  redirect("/");
}

export async function sendMagicLinkAction(
  input: MagicLinkInput,
): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) {
    return {
      ok: false,
      error: "Could not send magic link. Try again in a moment.",
    };
  }

  return { ok: true, message: "Check your email for a sign-in link." };
}

export async function signupAction(input: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/verify-email");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
