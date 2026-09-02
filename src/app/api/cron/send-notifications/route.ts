import { NextResponse } from "next/server";

import { dispatchPendingNotifications } from "@/lib/notifications/dispatch";

export const maxDuration = 60;

/** Vercel Cron target, scheduled frequently (see vercel.json) so a queued
 * notification goes out within minutes rather than waiting for the daily
 * sweep. Reads from the notifications table only — nothing here decides
 * *when* to notify, that happens where each notification gets queued
 * (see src/lib/notifications/queue.ts call sites). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await dispatchPendingNotifications();
  return NextResponse.json(result);
}
