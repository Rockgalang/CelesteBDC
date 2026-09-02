import type { Metadata } from "next";

import { NewJobForm } from "@/app/(app)/registrations/new/new-job-form";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New registration job — Celeste.bdc",
};

export default async function NewRegistrationJobPage() {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name")
    .order("business_name", { ascending: true });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New registration job
        </h1>
        <p className="text-muted-foreground text-sm">
          Creating a job instantiates its checklist and stages from the current
          template for that registration type.
        </p>
      </div>
      <NewJobForm clients={clients ?? []} />
    </div>
  );
}
