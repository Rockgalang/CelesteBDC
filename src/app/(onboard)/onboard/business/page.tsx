import { redirect } from "next/navigation";

import { BusinessDetailsForm } from "@/app/(onboard)/onboard/business/business-details-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardBusinessPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    redirect("/onboard");
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", profile.client_id)
    .single();

  if (!client) redirect("/onboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Complete your business details
        </h1>
        <p className="text-muted-foreground text-sm">
          Fill in what you have — you can always update this later. It helps
          us register and file for you correctly.
        </p>
      </div>
      <BusinessDetailsForm client={client} />
    </div>
  );
}
