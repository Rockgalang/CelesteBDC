import type { Metadata } from "next";

import { SignupForm } from "@/app/(auth)/signup/signup-form";

export const metadata: Metadata = { title: "Sign up — Celeste.bdc" };

export default function SignupPage() {
  return <SignupForm />;
}
