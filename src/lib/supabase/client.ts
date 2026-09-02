import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/** Browser-side Supabase client. Only ever uses the anon key — RLS is what
 * keeps this safe, never client-side authorization logic. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
