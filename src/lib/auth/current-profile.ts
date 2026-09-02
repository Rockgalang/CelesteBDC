import "server-only";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ProfilesRow, UserRole } from "@/lib/supabase/types";

export type CurrentProfile = ProfilesRow & { email: string | null };

/** Fetch the signed-in user's profile row. Redirects to /login if there is
 * no session — middleware already does this for most routes, but Server
 * Components can render ahead of a stale middleware pass, so this is the
 * real guard. */
export async function getCurrentProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return { ...profile, email: user.email ?? null };
}

const INTERNAL_ROLES: UserRole[] = ["owner", "staff"];

export function isInternalRole(role: UserRole) {
  return INTERNAL_ROLES.includes(role);
}

/** Page-level guard: redirect non-matching roles to the dashboard instead
 * of rendering. Use in addition to RLS, never instead of it — this only
 * hides UI, the database policies are the real authorization boundary. */
export async function requireRole(...allowed: UserRole[]) {
  const profile = await getCurrentProfile();
  if (!allowed.includes(profile.role)) {
    redirect("/dashboard");
  }
  return profile;
}
