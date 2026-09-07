import { redirect } from "next/navigation";

import { QuestionnaireForm } from "@/app/(onboard)/onboard/questionnaire/questionnaire-form";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export default async function OnboardQuestionnairePage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "client_admin" || !profile.client_id) {
    redirect("/onboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          A few quick questions
        </h1>
        <p className="text-muted-foreground text-sm">
          This helps us set up your bookkeeping and reminders the way your
          business actually works.
        </p>
      </div>
      <QuestionnaireForm />
    </div>
  );
}
