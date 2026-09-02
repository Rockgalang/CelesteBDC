import { NextResponse } from "next/server";

import { queueNotificationToClientAdmins } from "@/lib/notifications/queue";
import { runRenewalReminders } from "@/lib/renewals/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const WARNING_DAYS = [7, 12] as const;
const GRACE_AT_DAY = 15;
const SUSPEND_AT_DAY = 22;

/**
 * Vercel Cron target, scheduled daily (see vercel.json). Walks every
 * unpaid, past-due invoice and:
 *  - queues a warning notification at day 7 and day 12 past due_date
 *  - flips the subscription to `grace` at day 15
 *  - flips it to `suspended` at day 22 (build spec §7.8 names day 15 as
 *    the grace trigger but doesn't give a suspension threshold; 7 more
 *    days is this build's default — adjust via billing_config if a
 *    different number is wanted)
 *
 * Notifications fire only on the exact threshold day (so a client isn't
 * re-warned every day once past it); the status updates use `>=` with an
 * idempotent filter so a missed cron run still self-heals on the next one.
 *
 * Suspension "restricts portal write access but never deletes data or
 * blocks document downloads" per the spec — that restriction is enforced
 * where writes happen (e.g. receipt upload, once Phase 2 builds it), not
 * here; this route only maintains subscriptions.status as the source of
 * truth for those checks.
 *
 * Also runs the renewal-reminder sweep (build spec §8, Phase 5) — see
 * src/lib/renewals/reminders.ts for why it lives here instead of its own
 * cron entry.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();

  const { data: overdueInvoices, error } = await supabase
    .from("invoices")
    .select(
      "id, number, client_id, subscription_id, due_date, status, clients(business_name)",
    )
    .in("status", ["issued", "partially_paid", "overdue"])
    .lt("due_date", today.toISOString().slice(0, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const invoice of overdueInvoices ?? []) {
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(invoice.due_date).getTime()) / 86_400_000,
    );
    const client = invoice.clients as unknown as {
      business_name: string;
    } | null;
    const payload = {
      business_name: client?.business_name ?? "",
      invoice_number: invoice.number ?? "",
    };

    if (invoice.status !== "overdue") {
      await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .eq("id", invoice.id);
    }

    if ((WARNING_DAYS as readonly number[]).includes(daysOverdue)) {
      await queueNotificationToClientAdmins(supabase, {
        clientId: invoice.client_id,
        template: `payment_overdue_warning_day${daysOverdue}`,
        payload,
      });
    }

    if (invoice.subscription_id) {
      if (daysOverdue === SUSPEND_AT_DAY) {
        await queueNotificationToClientAdmins(supabase, {
          clientId: invoice.client_id,
          template: "payment_overdue_suspended",
          payload,
        });
      }

      if (daysOverdue >= SUSPEND_AT_DAY) {
        await supabase
          .from("subscriptions")
          .update({ status: "suspended" })
          .eq("id", invoice.subscription_id)
          .neq("status", "suspended");
      } else if (daysOverdue >= GRACE_AT_DAY) {
        await supabase
          .from("subscriptions")
          .update({ status: "grace" })
          .eq("id", invoice.subscription_id)
          .eq("status", "active");
      }
    }

    results.push({ invoiceId: invoice.id, daysOverdue });
  }

  const renewalReminders = await runRenewalReminders(supabase);

  return NextResponse.json({ swept: results, renewalReminders });
}
