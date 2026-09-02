import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/verify-email"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes. This is a
 * defense-in-depth convenience layer, not the authorization boundary —
 * RLS is. Never gate access to data solely on this middleware.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing Supabase config would otherwise throw inside createServerClient
  // (an invalid URL) and 500 every request via MIDDLEWARE_INVOCATION_FAILED.
  // Fail open here instead — every page still redirects to /login (no user
  // session ever resolves), but the deployment stays up rather than
  // crashing outright while credentials are being wired in.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase env vars are not configured — see .env.example. Auth is disabled until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
    );
    if (isPublicPath(request.nextUrl.pathname)) {
      return NextResponse.next({ request });
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicPath(pathname) && pathname !== "/auth/callback") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}
