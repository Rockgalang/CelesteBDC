import "server-only";
import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

function renderTemplate(
  text: string,
  payload: Record<string, unknown>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = payload[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Sends every notification that's due and not yet sent. Called from
 * /api/cron/send-notifications. Failures are recorded on the row
 * (delivery_status = 'failed', error = message) rather than thrown, so
 * one bad address doesn't stop the rest of the batch.
 */
export async function dispatchPendingNotifications() {
  const supabase = createAdminClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("delivery_status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(50);

  if (error) {
    return { sent: 0, failed: 0, error: error.message };
  }

  if (!notifications || notifications.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const { data: template } = await supabase
        .from("email_templates")
        .select("*")
        .eq("key", notification.template)
        .single();

      if (!template) {
        throw new Error(
          `No email_templates row for key "${notification.template}"`,
        );
      }

      const { data: user } = await supabase.auth.admin.getUserById(
        notification.recipient_profile_id,
      );
      const email = user?.user?.email;
      if (!email) {
        throw new Error("Recipient has no email address on file.");
      }

      const payload = notification.payload as Record<string, unknown>;
      const subject = renderTemplate(template.subject, payload);
      const body = renderTemplate(template.body_text, payload);

      if (!resend) {
        throw new Error("RESEND_API_KEY is not configured.");
      }

      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "hello@celestebdc.com",
        to: email,
        subject,
        text: body,
      });
      if (sendError) throw new Error(sendError.message);

      await supabase
        .from("notifications")
        .update({
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", notification.id);
      sent += 1;
    } catch (err) {
      await supabase
        .from("notifications")
        .update({
          delivery_status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", notification.id);
      failed += 1;
    }
  }

  return { sent, failed };
}
