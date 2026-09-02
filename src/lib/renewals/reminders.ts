import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const LOOKAHEAD_DAYS = 30;

/**
 * Build spec §8 places a "renewal engine" in Phase 5 that auto-creates a
 * renewal registration_job when a permit/certificate nears expiry. That
 * needs a reliable document -> job_type mapping this build doesn't have
 * (document categories are generic free text, not tied to a specific
 * BIR/DTI/SEC form) — guessing wrong here would be worse than not
 * automating it.
 *
 * So this is the scoped-down, honest version: for every document expiring
 * within 30 days, ensure exactly one internal task exists reminding
 * owner/staff to start the renewal themselves (they still pick the right
 * registration_job type by hand). Idempotent — `source_type` +
 * `source_id` uniquely key each document, so calling this daily never
 * creates duplicates.
 *
 * Called from /api/cron/sweep-subscriptions (already scheduled daily)
 * rather than getting its own vercel.json cron entry — Hobby-plan
 * projects have a low cap on the number of cron jobs, and this doesn't
 * need its own schedule slot.
 */
export async function runRenewalReminders(supabase: SupabaseClient<Database>) {
  const today = new Date();
  const lookahead = new Date(today);
  lookahead.setDate(lookahead.getDate() + LOOKAHEAD_DAYS);

  const { data: expiringDocuments, error } = await supabase
    .from("documents")
    .select("id, filename, category, expires_at, client_id")
    .not("expires_at", "is", null)
    .not("client_id", "is", null)
    .gte("expires_at", today.toISOString().slice(0, 10))
    .lte("expires_at", lookahead.toISOString().slice(0, 10));

  if (error) {
    return { checked: 0, created: 0, error: error.message };
  }

  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("source_id")
    .eq("source_type", "document_renewal")
    .not("source_id", "is", null);
  const existingIds = new Set((existingTasks ?? []).map((t) => t.source_id));

  let created = 0;
  for (const doc of expiringDocuments ?? []) {
    if (existingIds.has(doc.id) || !doc.client_id || !doc.expires_at) continue;

    const daysUntilExpiry = Math.ceil(
      (new Date(doc.expires_at).getTime() - today.getTime()) / 86_400_000,
    );

    const { error: insertError } = await supabase.from("tasks").insert({
      client_id: doc.client_id,
      title: `Renew: ${doc.filename} (${doc.category}) — expires ${doc.expires_at}`,
      kind: "document_renewal",
      due_at: `${doc.expires_at}T00:00:00Z`,
      priority: daysUntilExpiry <= 7 ? "urgent" : "normal",
      source_type: "document_renewal",
      source_id: doc.id,
    });
    if (!insertError) created += 1;
  }

  return { checked: expiringDocuments?.length ?? 0, created };
}
