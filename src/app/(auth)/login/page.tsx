import type { Metadata } from "next";

import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = { title: "Sign in — Celeste.bdc" };

export default function LoginPage() {
  return <LoginForm />;
}
