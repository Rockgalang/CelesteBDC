import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/** Server-side Supabase client for use in Server Components, Server
 * Actions, and Route Handlers. Runs as the requesting user (anon key +
 * their session cookie) so every query is still subject to RLS. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no request/response to
            // attach cookies to — middleware refreshes the session on the
            // next navigation instead. Safe to ignore.
          }
        },
      },
    },
  );
}
