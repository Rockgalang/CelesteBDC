import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client. Bypasses RLS entirely — this must never be
 * imported into any client-facing code path or exposed to a request whose
 * authorization hasn't already been checked in application code.
 *
 * Legitimate uses in Phase 0: generating signed URLs for the document
 * vault, the owner-bootstrap script, and audit-log backfills. Every call
 * site using this client is responsible for its own authorization check —
 * there is no RLS safety net here.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
