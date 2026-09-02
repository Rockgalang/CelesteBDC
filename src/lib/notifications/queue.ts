import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/** Queue a notification row. Sending happens later, from
 * /api/cron/send-notifications — this never calls Resend directly, so it's
 * safe to call from request-time code (a server action, a cron route)
 * without worrying about email latency or delivery failures blocking the
 * caller. */
export async function queueNotification(
  supabase: SupabaseClient<Database>,
  params: {
    recipientProfileId: string;
    template: string;
    payload?: Record<string, unknown>;
  },
) {
  await supabase.from("notifications").insert({
    recipient_profile_id: params.recipientProfileId,
    template: params.template,
    payload: params.payload ?? {},
  });
}

/** Billing/registration events are client-scoped, but notifications are
 * per-profile — a client can have more than one client_admin. Fan out to
 * all of them (client_user is intentionally excluded from billing
 * notifications, matching the invoices RLS/nav restriction). */
export async function queueNotificationToClientAdmins(
  supabase: SupabaseClient<Database>,
  params: {
    clientId: string;
    template: string;
    payload?: Record<string, unknown>;
  },
) {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("role", "client_admin");

  for (const admin of admins ?? []) {
    await queueNotification(supabase, {
      recipientProfileId: admin.id,
      template: params.template,
      payload: params.payload,
    });
  }
}
