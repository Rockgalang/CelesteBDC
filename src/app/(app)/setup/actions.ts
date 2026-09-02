"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/(auth)/actions";

/** Claims the owner role for the current user. The
 * bootstrap_first_owner() Postgres function only succeeds while zero
 * owners exist, so this is safe to leave reachable — it cannot be used to
 * escalate privileges once a real owner is set up. */
export async function claimOwnerAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_first_owner");
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
