import { ClaimOwnerButton } from "@/app/(app)/setup/claim-owner-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: ownerExists } = await supabase.rpc("owner_exists");

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>First-time setup</CardTitle>
          <CardDescription>
            Claim the owner role for this Celeste BDC workspace. This only works
            once — while no owner account exists yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ownerExists ? (
            <p className="text-muted-foreground text-sm">
              An owner account already exists. Ask them to promote your account
              from the client registry if you need staff access.
            </p>
          ) : (
            <ClaimOwnerButton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
