import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/current-profile";
import { OnboardStepper } from "@/app/(onboard)/onboard/stepper";

export default async function OnboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Step 1 (business + plan creation) is for a client_user with no
  // business yet; every later step needs the client_admin promotion that
  // step produces. Owner/staff never land here. A client_user who already
  // belongs to a client (added by staff under an existing business) isn't
  // registering a new one either.
  const belongsHere =
    (profile.role === "client_user" && !profile.client_id) ||
    profile.role === "client_admin";
  if (!belongsHere) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-muted/30 min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Celeste<span className="text-primary">.bdc</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <OnboardStepper hasClient={!!profile.client_id} />
        {children}
      </div>
    </div>
  );
}
