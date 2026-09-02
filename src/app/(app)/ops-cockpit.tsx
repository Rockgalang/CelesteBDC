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
import { formatManila, formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { upcomingTaxObligations } from "@/lib/tax/deadlines";
import { createClient } from "@/lib/supabase/server";

/**
 * Cel's home screen (build spec §7.1): one prioritized queue, sorted by
 * risk of penalty. Every section below is wired to real data now that
 * the module backing it has shipped, except "Payroll runs due" and
 * "Clients missing documents" — payroll and document-request tracking
 * genuinely don't exist yet (see README's "deliberately not here yet").
 */
export async function OpsCockpit() {
  const supabase = await createClient();
  const today = new Date();

  const in90Days = new Date(today);
  in90Days.setDate(in90Days.getDate() + 90);

  const [
    { data: expiringDocuments },
    { data: activeClients },
    { data: filedTaskRows },
    { data: receiptsQueue },
    { data: stalledJobs },
    { data: unpaidInvoices },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, filename, category, expires_at, clients(business_name)")
      .not("expires_at", "is", null)
      .gte("expires_at", today.toISOString().slice(0, 10))
      .lte("expires_at", in90Days.toISOString().slice(0, 10))
      .order("expires_at", { ascending: true })
      .limit(5),
    supabase
      .from("clients")
      .select("id, business_name, entity_type, tax_type, vat_registered")
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("client_id, kind")
      .eq("status", "done")
      .like("kind", "tax_filing:%"),
    supabase
      .from("receipts")
      .select("id, vendor_name, amount, status, clients(business_name)")
      .in("status", ["uploaded", "processing", "needs_review", "ocr_failed"])
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("registration_jobs")
      .select("id, job_type, status, clients(business_name)")
      .eq("status", "blocked")
      .limit(5),
    supabase
      .from("invoices")
      .select("id, number, total, status, clients(business_name)")
      .in("status", ["issued", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  const permitCount = expiringDocuments?.length ?? 0;

  const filedKeysByClient = new Map<string, Set<string>>();
  for (const t of filedTaskRows ?? []) {
    if (!t.client_id) continue;
    const set = filedKeysByClient.get(t.client_id) ?? new Set<string>();
    set.add(t.kind);
    filedKeysByClient.set(t.client_id, set);
  }

  type DueFiling = {
    clientId: string;
    businessName: string;
    formNumber: string;
    dueDate: string;
  };
  const dueFilings: DueFiling[] = [];
  for (const c of activeClients ?? []) {
    const obligations = upcomingTaxObligations(
      { taxType: c.tax_type, vatRegistered: c.vat_registered, entityType: c.entity_type },
      { today, monthsAhead: 1, overdueGraceDays: 30 },
    );
    const filed = filedKeysByClient.get(c.id) ?? new Set<string>();
    for (const o of obligations) {
      if (!filed.has(`tax_filing:${o.formNumber}:${o.dueDate}`)) {
        dueFilings.push({
          clientId: c.id,
          businessName: c.business_name,
          formNumber: o.formNumber,
          dueDate: o.dueDate,
        });
      }
    }
  }
  dueFilings.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueFilingsTop = dueFilings.slice(0, 5);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CockpitSection
        title="Filings due"
        icon={CalendarClockIcon}
        count={dueFilings.length}
        urgent
        href="/clients"
        emptyLabel="Nothing due from an active client in the next 30 days."
      >
        <ul className="space-y-2">
          {dueFilingsTop.map((f) => (
            <li
              key={`${f.clientId}-${f.formNumber}-${f.dueDate}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate">
                {f.businessName} · {f.formNumber}
              </span>
              <Badge variant="outline">{formatManila(f.dueDate)}</Badge>
            </li>
          ))}
        </ul>
      </CockpitSection>

      <CockpitSection
        title="Receipts awaiting review"
        icon={ReceiptIcon}
        count={receiptsQueue?.length ?? 0}
        href="/receipts/review"
        emptyLabel="Nothing in the receipt review queue."
      >
        <ul className="space-y-2">
          {receiptsQueue?.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {(r.clients as unknown as { business_name: string } | null)
                  ?.business_name ?? "—"}{" "}
                · {r.vendor_name ?? "unread"}
              </span>
              <Badge variant="outline">
                {r.amount ? formatPeso(money(r.amount)) : "—"}
              </Badge>
            </li>
          ))}
        </ul>
      </CockpitSection>

      <CockpitSection
        title="Payroll runs due"
        icon={WalletIcon}
        count={0}
        emptyLabel="Payroll runs aren't built yet — see the Payroll page for plan eligibility."
        href="/payroll"
      />

      <CockpitSection
        title="Clients missing documents"
        icon={FileTextIcon}
        count={0}
        emptyLabel="Document-request tracking isn't built yet."
      />

      <CockpitSection
        title="Registrations stalled"
        icon={WorkflowIcon}
        count={stalledJobs?.length ?? 0}
        urgent
        href="/registrations"
        emptyLabel="No registration jobs are blocked."
      >
        <ul className="space-y-2">
          {stalledJobs?.map((j) => (
            <li key={j.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {(j.clients as unknown as { business_name: string } | null)
                  ?.business_name ?? "—"}
              </span>
              <Badge variant="outline">{j.job_type}</Badge>
            </li>
          ))}
        </ul>
      </CockpitSection>

      <CockpitSection
        title="Invoices unpaid"
        icon={AlertTriangleIcon}
        count={unpaidInvoices?.length ?? 0}
        urgent
        href="/invoices"
        emptyLabel="No unpaid invoices."
      >
        <ul className="space-y-2">
          {unpaidInvoices?.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {(inv.clients as unknown as { business_name: string } | null)
                  ?.business_name ?? "—"}{" "}
                · {inv.number ?? "draft"}
              </span>
              <Badge variant="outline">{formatPeso(money(inv.total))}</Badge>
            </li>
          ))}
        </ul>
      </CockpitSection>

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
