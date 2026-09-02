"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export async function updateEmailTemplateAction(
  key: string,
  subject: string,
  bodyText: string,
): Promise<ActionResult> {
  await requireRole("owner");

  if (!subject.trim() || !bodyText.trim()) {
    return { ok: false, error: "Subject and body are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({ subject, body_text: bodyText })
    .eq("key", key);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings/email-templates");
  return { ok: true };
}
