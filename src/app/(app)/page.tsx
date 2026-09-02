import { OpsCockpit } from "@/app/(app)/ops-cockpit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {profile.full_name || "there"}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            The client portal — receipt uploads, financial statements, invoices,
            and payslips — ships in a later phase.
          </p>
          <p>
            For now, reach your Celeste BDC contact directly for anything you
            need.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
