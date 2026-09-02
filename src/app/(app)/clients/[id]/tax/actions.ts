"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

function obligationKind(formNumber: string, dueDate: string) {
  return `tax_filing:${formNumber}:${dueDate}`;
}

export async function markTaxObligationFiledAction(
  clientId: string,
  formNumber: string,
  dueDate: string,
  description: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const kind = obligationKind(formNumber, dueDate);

  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("client_id", clientId)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("tasks").insert({
      client_id: clientId,
      title: `${formNumber} — ${description}`,
      kind,
      due_at: `${dueDate}T00:00:00Z`,
      status: "done",
      source_type: "tax_obligation",
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/tax`);
  return { ok: true };
}

export async function unmarkTaxObligationFiledAction(
  clientId: string,
  formNumber: string,
  dueDate: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const kind = obligationKind(formNumber, dueDate);

  const { error } = await supabase
    .from("tasks")
    .update({ status: "open" })
    .eq("client_id", clientId)
    .eq("kind", kind);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${clientId}/tax`);
  return { ok: true };
}
