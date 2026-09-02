import type { Metadata } from "next";

import { TemplateEditor } from "@/app/(app)/settings/email-templates/template-editor";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Email templates — Celeste.bdc" };

export default async function EmailTemplatesPage() {
  await requireRole("owner");

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .order("key");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Email templates
        </h1>
        <p className="text-muted-foreground text-sm">
          Edit the wording sent for each notification. Use{" "}
          <code className="bg-muted rounded px-1 py-0.5">
            {"{{placeholder}}"}
          </code>{" "}
          for values filled in at send time.
        </p>
      </div>
      <div className="space-y-4">
        {(templates ?? []).map((t) => (
          <TemplateEditor key={t.key} template={t} />
        ))}
      </div>
    </div>
  );
}
