import {
  AlertTriangleIcon,
  CalendarClockIcon,
  FileTextIcon,
  ReceiptIcon,
  ShieldAlertIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react";

import { CockpitSection } from "@/components/cockpit/cockpit-section";
import { Badge } from "@/components/ui/badge";
import { formatManila } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * Cel's home screen (build spec §7.1): one prioritized queue, sorted by
 * risk of penalty. Phase 0 only has the client registry and document
 * vault to query against, so "Permits expiring" is the one section wired
 * to real data — the rest render an honest empty state until the tables
 * that back them (registration_jobs, receipts, tax_obligations,
 * payroll_runs, invoices) land in Phases 1-4. Every section keeps its
 * spec-defined title, icon, and link target so later phases only need to
 * swap the query, not the layout.
 */
export async function OpsCockpit() {
  const supabase = await createClient();

  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);

  const { data: expiringDocuments } = await supabase
    .from("documents")
    .select("id, filename, category, expires_at, clients(business_name)")
    .not("expires_at", "is", null)
    .gte("expires_at", new Date().toISOString().slice(0, 10))
    .lte("expires_at", in90Days.toISOString().slice(0, 10))
    .order("expires_at", { ascending: true })
    .limit(5);

  const permitCount = expiringDocuments?.length ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CockpitSection
        title="Filings due"
        icon={CalendarClockIcon}
        count={0}
        urgent
        emptyLabel="No obligations tracked yet — the tax engine ships in Phase 3."
      />
      <CockpitSection
        title="Receipts awaiting review"
        icon={ReceiptIcon}
        count={0}
        emptyLabel="Receipt capture ships in Phase 2."
      />
      <CockpitSection
        title="Payroll runs due"
        icon={WalletIcon}
        count={0}
        emptyLabel="Payroll ships in Phase 4."
      />
      <CockpitSection
        title="Clients missing documents"
        icon={FileTextIcon}
        count={0}
        emptyLabel="Document request tracking ships in Phase 1."
      />
      <CockpitSection
        title="Registrations stalled"
        icon={WorkflowIcon}
        count={0}
        emptyLabel="The registration pipeline ships in Phase 1."
      />
      <CockpitSection
        title="Invoices unpaid"
        icon={AlertTriangleIcon}
        count={0}
        urgent
        emptyLabel="Billing ships in Phase 1."
      />
      <CockpitSection
        title="Permits expiring (90 days)"
        icon={ShieldAlertIcon}
        count={permitCount}
        href="/clients"
        emptyLabel="Nothing expiring in the next 90 days."
      >
        <ul className="space-y-2">
          {expiringDocuments?.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate">
                {(doc.clients as unknown as { business_name: string } | null)
                  ?.business_name ?? "—"}{" "}
                · {doc.category}
              </span>
              <Badge variant="outline">
                {doc.expires_at ? formatManila(doc.expires_at) : "—"}
              </Badge>
            </li>
          ))}
        </ul>
      </CockpitSection>
    </div>
  );
}
