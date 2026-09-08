import Link from "next/link";
import { CheckCircle2Icon, CircleDashedIcon, ClockIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { RegistrationJobsRow } from "@/lib/supabase/types";

type ChecklistItemState = "done" | "in_progress" | "not_started";

function StatusIcon({ state }: { state: ChecklistItemState }) {
  if (state === "done")
    return <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />;
  if (state === "in_progress")
    return <ClockIcon className="text-primary size-4 shrink-0" />;
  return <CircleDashedIcon className="text-muted-foreground size-4 shrink-0" />;
}

function registrationState(
  jobs: RegistrationJobsRow[],
  jobTypes: string[],
): { state: ChecklistItemState; detail: string } {
  const matches = jobs.filter((j) => jobTypes.includes(j.job_type));
  if (matches.some((j) => j.status === "completed"))
    return { state: "done", detail: "Completed" };
  const active = matches.find((j) =>
    ["in_progress", "not_started", "blocked"].includes(j.status),
  );
  if (active)
    return {
      state: active.status === "blocked" ? "in_progress" : "in_progress",
      detail: active.current_stage ?? active.status.replace("_", " "),
    };
  return { state: "not_started", detail: "Not started" };
}

const REPORT_FREQUENCY_LABEL: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  irregular: "whenever you have activity",
};

export async function ComplianceChecklist({
  clientId,
}: {
  clientId: string;
}) {
  const supabase = await createClient();
  const [{ data: jobs }, { data: client }, { data: subscription }, { data: lastReceipt }] =
    await Promise.all([
      supabase
        .from("registration_jobs")
        .select("*")
        .eq("client_id", clientId),
      supabase
        .from("clients")
        .select("entity_type, intake_responses")
        .eq("id", clientId)
        .single(),
      supabase
        .from("subscriptions")
        .select("plans(features)")
        .eq("client_id", clientId)
        .in("status", ["active", "grace", "suspended"])
        .maybeSingle(),
      supabase
        .from("receipts")
        .select("created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const nameRegistrationTypes =
    client && ["opc", "corporation", "partnership"].includes(client.entity_type)
      ? ["sec"]
      : ["dti"];
  const nameRegistration = registrationState(jobs ?? [], nameRegistrationTypes);
  const birRegistration = registrationState(jobs ?? [], ["bir_registration"]);
  const mayorsPermit = registrationState(jobs ?? [], ["lgu_mayors_permit"]);

  const planFeatures =
    (subscription?.plans as unknown as { features?: Record<string, unknown> })
      ?.features ?? {};
  const payrollLocked = planFeatures?.payroll_locked === true;

  const intake = (client?.intake_responses ?? {}) as Record<string, unknown>;
  const frequency =
    (intake.salesReportFrequency as string | undefined) ?? "monthly";
  const frequencyLabel = REPORT_FREQUENCY_LABEL[frequency] ?? "regularly";
  const lastUpload = lastReceipt?.created_at;
  const reportsUpToDate = lastUpload
    ? Date.now() - new Date(lastUpload).getTime() <
      (frequency === "daily" ? 2 : frequency === "weekly" ? 8 : 32) *
        24 *
        60 *
        60 *
        1000
    : false;

  const items: {
    label: string;
    state: ChecklistItemState;
    detail: string;
    href?: string;
  }[] = [
    {
      label: nameRegistrationTypes[0] === "sec" ? "SEC Registration" : "DTI Registration",
      state: nameRegistration.state,
      detail: nameRegistration.detail,
      href: "/onboard/permits",
    },
    {
      label: "BIR Registration",
      state: birRegistration.state,
      detail: birRegistration.detail,
      href: "/onboard/permits",
    },
    {
      label: "Mayor's Permit Registration",
      state: mayorsPermit.state,
      detail: mayorsPermit.detail,
      href: "/onboard/permits",
    },
    {
      label: "Payroll / commission setup",
      state: payrollLocked ? "not_started" : "in_progress",
      detail: payrollLocked
        ? "Not included on your plan"
        : "Managed by Celeste — contact us to set it up",
    },
    {
      label: "Sales report",
      state: reportsUpToDate ? "done" : "not_started",
      detail: lastUpload
        ? `Last uploaded ${formatManila(lastUpload)} · due ${frequencyLabel}`
        : `Due ${frequencyLabel} — none uploaded yet`,
      href: "/receipts",
    },
    {
      label: "Expense report",
      state: reportsUpToDate ? "done" : "not_started",
      detail: lastUpload
        ? `Last uploaded ${formatManila(lastUpload)} · due ${frequencyLabel}`
        : `Due ${frequencyLabel} — none uploaded yet`,
      href: "/receipts",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => {
            const row = (
              <div className="flex items-center gap-3">
                <StatusIcon state={item.state} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground truncate text-xs capitalize">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={cn(
                      "-mx-2 block rounded-md px-2 py-1",
                      "hover:bg-accent",
                    )}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="-mx-2 px-2 py-1">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
