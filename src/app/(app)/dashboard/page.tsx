import { OpsCockpit } from "@/app/(app)/ops-cockpit";
import { PortalHome } from "@/app/(app)/portal-home";
import { getCurrentProfile, isInternalRole } from "@/lib/auth/current-profile";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (isInternalRole(profile.role)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ops Cockpit</h1>
          <p className="text-muted-foreground text-sm">
            What needs your attention right now, sorted by risk.
          </p>
        </div>
        <OpsCockpit />
      </div>
    );
  }

  return <PortalHome profile={profile} />;
}
