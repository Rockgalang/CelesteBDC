import type { EntityType, TaxType } from "@/lib/supabase/types";

/**
 * Philippine BIR filing calendar — a planning aid only. Deadlines here
 * follow the commonly-cited BIR rules as of this build, but BIR revenue
 * regulations and memorandum circulars change these dates periodically
 * (and RDO-specific rulings can vary). ⚠️ This is not a substitute for a
 * CPA — Celeste BDC is not a CPA or law firm (build spec §2.2). Always
 * verify against the current BIR issuance before relying on a date here.
 *
 * No BIR filing API exists (build spec §2.4) — this calendar only tells
 * you what's due and when; nothing here files anything automatically.
 */

export type TaxObligation = {
  formNumber: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  frequency: "quarterly" | "annual";
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function withinWindow(dueDate: string, windowStart: string, windowEnd: string) {
  return dueDate >= windowStart && dueDate <= windowEnd;
}

/**
 * Every quarterly/annual obligation whose due date falls within
 * [today - overdueGraceDays, today + monthsAhead], for a client with the
 * given tax profile. `entityType === 'sole_proprietor'` uses the
 * individual income-tax forms (1701Q/1701); everything else uses the
 * corporate forms (1702Q/1702).
 */
export function upcomingTaxObligations(
  client: { taxType: TaxType; vatRegistered: boolean; entityType: EntityType },
  opts: { today?: Date; monthsAhead?: number; overdueGraceDays?: number } = {},
): TaxObligation[] {
  const today = opts.today ?? new Date();
  const monthsAhead = opts.monthsAhead ?? 6;
  const overdueGraceDays = opts.overdueGraceDays ?? 60;

  const graceStart = new Date(today);
  graceStart.setUTCDate(graceStart.getUTCDate() - overdueGraceDays);
  const windowStartWithGrace = ymd(
    graceStart.getUTCFullYear(),
    graceStart.getUTCMonth() + 1,
    graceStart.getUTCDate(),
  );
  const windowEndDate = new Date(today);
  windowEndDate.setUTCMonth(windowEndDate.getUTCMonth() + monthsAhead);
  const windowEnd = ymd(
    windowEndDate.getUTCFullYear(),
    windowEndDate.getUTCMonth() + 1,
    windowEndDate.getUTCDate(),
  );

  const isIndividual = client.entityType === "sole_proprietor";
  const obligations: TaxObligation[] = [];

  // Cover a couple of years so quarter/annual boundaries near "today"
  // aren't missed, then filter down to the requested window.
  const years = [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1];

  for (const year of years) {
    // --- VAT / Percentage tax: quarterly, due 25th of the month after
    // the quarter closes (Q4's due date lands in the following January).
    if (client.taxType === "vat" || client.vatRegistered) {
      obligations.push(
        { formNumber: "2550Q", description: "Quarterly VAT Return (Q1)", dueDate: ymd(year, 4, 25), frequency: "quarterly" },
        { formNumber: "2550Q", description: "Quarterly VAT Return (Q2)", dueDate: ymd(year, 7, 25), frequency: "quarterly" },
        { formNumber: "2550Q", description: "Quarterly VAT Return (Q3)", dueDate: ymd(year, 10, 25), frequency: "quarterly" },
        { formNumber: "2550Q", description: "Quarterly VAT Return (Q4)", dueDate: ymd(year + 1, 1, 25), frequency: "quarterly" },
      );
    } else if (client.taxType === "percentage") {
      obligations.push(
        { formNumber: "2551Q", description: "Quarterly Percentage Tax Return (Q1)", dueDate: ymd(year, 4, 25), frequency: "quarterly" },
        { formNumber: "2551Q", description: "Quarterly Percentage Tax Return (Q2)", dueDate: ymd(year, 7, 25), frequency: "quarterly" },
        { formNumber: "2551Q", description: "Quarterly Percentage Tax Return (Q3)", dueDate: ymd(year, 10, 25), frequency: "quarterly" },
        { formNumber: "2551Q", description: "Quarterly Percentage Tax Return (Q4)", dueDate: ymd(year + 1, 1, 25), frequency: "quarterly" },
      );
    }
    // taxType === "exempt": no recurring VAT/percentage obligation.

    // --- Income tax: quarterly + annual.
    if (isIndividual) {
      obligations.push(
        { formNumber: "1701Q", description: "Quarterly Income Tax Return (Q1)", dueDate: ymd(year, 5, 15), frequency: "quarterly" },
        { formNumber: "1701Q", description: "Quarterly Income Tax Return (Q2)", dueDate: ymd(year, 8, 15), frequency: "quarterly" },
        { formNumber: "1701Q", description: "Quarterly Income Tax Return (Q3)", dueDate: ymd(year, 11, 15), frequency: "quarterly" },
        { formNumber: "1701", description: "Annual Income Tax Return", dueDate: ymd(year, 4, 15), frequency: "annual" },
      );
    } else {
      obligations.push(
        { formNumber: "1702Q", description: "Quarterly Income Tax Return (Q1)", dueDate: ymd(year, 5, 30), frequency: "quarterly" },
        { formNumber: "1702Q", description: "Quarterly Income Tax Return (Q2)", dueDate: ymd(year, 8, 29), frequency: "quarterly" },
        { formNumber: "1702Q", description: "Quarterly Income Tax Return (Q3)", dueDate: ymd(year, 11, 29), frequency: "quarterly" },
        { formNumber: "1702", description: "Annual Income Tax Return", dueDate: ymd(year, 4, 15), frequency: "annual" },
      );
    }

    // --- Annual registration fee, every entity type.
    obligations.push({
      formNumber: "0605",
      description: "Annual Registration Fee",
      dueDate: ymd(year, 1, 31),
      frequency: "annual",
    });
  }

  return obligations
    .filter((o) => withinWindow(o.dueDate, windowStartWithGrace, windowEnd))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function isOverdue(dueDate: string, today: Date = new Date()): boolean {
  const todayStr = ymd(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  );
  return dueDate < todayStr;
}
