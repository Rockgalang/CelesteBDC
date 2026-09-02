import { NextResponse } from "next/server";

import { runRenewalReminders } from "@/lib/renewals/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Not scheduled in vercel.json — its logic runs daily as part of
 * /api/cron/sweep-subscriptions instead, to stay within the Hobby-plan
 * cron count. Kept as its own route for manual/on-demand invocation
 * (same CRON_SECRET auth as every other cron route).
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
  const result = await runRenewalReminders(supabase);
  return NextResponse.json(result);
}
