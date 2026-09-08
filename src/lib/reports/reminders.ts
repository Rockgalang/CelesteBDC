import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";

import { queueNotificationToClientAdmins } from "@/lib/notifications/queue";
import { MANILA_TZ } from "@/lib/format";
import type { Database } from "@/lib/supabase/types";

const STALE_HOURS: Record<string, number> = {
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30,
};

/**
 * Nudges a client to upload their sales/expense report against the
 * cadence they declared during self-registration (clients.intake_responses
 * .salesReportFrequency) — daily clients get checked every run, weekly
 * ones only on Monday, monthly ones only on the 1st, so nobody gets
 * reminded more often than they asked for. "irregular" clients are never
 * reminded (they said they don't have a regular cadence). Defaults to
 * monthly for a client with no declared preference (e.g. one staff
 * created directly rather than through self-registration).
 *
 * Called from /api/cron/sweep-subscriptions (already scheduled daily)
 * rather than getting its own vercel.json cron entry, same reasoning as
 * runRenewalReminders — Hobby-plan projects cap the number of cron jobs.
 */
export async function runReportReminders(supabase: SupabaseClient<Database>) {
  const now = new Date();
  const manilaWeekday = formatInTimeZone(now, MANILA_TZ, "EEEE");
  const manilaDayOfMonth = formatInTimeZone(now, MANILA_TZ, "d");

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, business_name, intake_responses")
    .eq("status", "active");

  if (error) {
    return { checked: 0, reminded: 0, error: error.message };
  }

  let reminded = 0;
  for (const client of clients ?? []) {
    const intake = (client.intake_responses ?? {}) as Record<string, unknown>;
    const frequency =
      (intake.salesReportFrequency as string | undefined) ?? "monthly";

    if (frequency === "irregular") continue;
    if (frequency === "weekly" && manilaWeekday !== "Monday") continue;
    if (frequency === "monthly" && manilaDayOfMonth !== "1") continue;

    const staleHours = STALE_HOURS[frequency] ?? STALE_HOURS.monthly;
    const cutoff = new Date(now.getTime() - staleHours * 60 * 60 * 1000);

    const [{ data: lastReceipt }, { data: lastManual }] = await Promise.all([
      supabase
        .from("receipts")
        .select("created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("manual_ledger_entries")
        .select("created_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const lastActivity = [lastReceipt?.created_at, lastManual?.created_at]
      .filter((v): v is string => !!v)
      .map((v) => new Date(v))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (lastActivity && lastActivity >= cutoff) continue;

    await queueNotificationToClientAdmins(supabase, {
      clientId: client.id,
      template: "report_reminder",
      payload: { business_name: client.business_name, frequency },
    });
    reminded += 1;
  }

  return { checked: clients?.length ?? 0, reminded };
}
