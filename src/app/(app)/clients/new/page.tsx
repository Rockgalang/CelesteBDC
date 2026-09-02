import type { Metadata } from "next";

import { ClientForm } from "@/app/(app)/clients/client-form";
import { requireRole } from "@/lib/auth/current-profile";

export const metadata: Metadata = { title: "New client — Celeste.bdc" };

export default async function NewClientPage() {
  await requireRole("owner", "staff");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
        <p className="text-muted-foreground text-sm">
          Add a client to the registry. This is the record; the full onboarding
          wizard ships in Phase 1.
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
