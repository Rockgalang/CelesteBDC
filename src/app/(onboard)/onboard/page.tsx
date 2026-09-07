import { redirect } from "next/navigation";

import { RegisterBusinessForm } from "@/app/(onboard)/onboard/register-business-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardStartPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "client_admin") {
    redirect("/onboard/payment");
  }

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Register your business
        </h1>
        <p className="text-muted-foreground text-sm">
          Tell us about your business and pick a plan. You can pay and finish
          the rest of your profile in the next steps.
        </p>
      </div>
      <RegisterBusinessForm plans={plans ?? []} />
    </div>
  );
}
