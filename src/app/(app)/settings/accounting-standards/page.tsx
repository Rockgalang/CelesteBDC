import type { Metadata } from "next";

import { AccountingStandardsPanel } from "@/app/(app)/settings/accounting-standards/accounting-standards-panel";
import { PayrollStandardsPanel } from "@/app/(app)/settings/accounting-standards/payroll-standards-panel";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accounting standards — Celeste.bdc" };

export default async function AccountingStandardsPage() {
  await requireRole("owner");

  const supabase = await createClient();
  const [{ data: sets }, { data: templates }, { data: payrollStandards }] =
    await Promise.all([
      supabase
        .from("chart_of_account_template_sets")
        .select("*")
        .order("is_builtin", { ascending: false })
        .order("created_at"),
      supabase
        .from("chart_of_account_templates")
        .select("*")
        .order("template_set_id")
        .order("sequence"),
      supabase.from("payroll_standards").select("*").eq("id", 1).single(),
    ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Accounting standards
        </h1>
        <p className="text-muted-foreground text-sm">
          Chart-of-account templates by business type. Duplicate a template
          to create a custom one per business type, edit its accounts
          freely, and pick which entity types default to it when a new
          client&apos;s books are seeded. Built-in templates can&apos;t be
          removed, but can be duplicated as a starting point.
        </p>
      </div>
      <AccountingStandardsPanel sets={sets ?? []} templates={templates ?? []} />
      {payrollStandards && <PayrollStandardsPanel standards={payrollStandards} />}
    </div>
  );
}
