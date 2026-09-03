import { NextResponse } from "next/server";

import { queueNotificationToClientAdmins } from "@/lib/notifications/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatManila, formatPeso } from "@/lib/format";
import { money, toDbString } from "@/lib/money";

export const maxDuration = 60;

/**
 * Vercel Cron target, scheduled for the 1st of the month (see
 * vercel.json). Generates one invoice per active subscription for its
 * current billing period, plus a line per unbilled government_fees row
 * for that client (build spec §7.8, §5.1), plus transaction/employee
 * overage lines now that Phase 2 (receipts) and Phase 4 (payroll) data
 * exist to count against `plans.txn_limit`/`employee_limit`.
 *
 * Overage counting uses the calendar month of the subscription's
 * current_period_start as the period key — approximate for a
 * subscription whose billing cycle doesn't align to calendar months
 * (bookkeeping transaction counts are stamped per calendar month by
 * `receipts.counted_period`, not per billing cycle).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: subscriptions, error: subsError } = await supabase
    .from("subscriptions")
    .select(
      "*, plans(price_monthly, price_annual_monthly, txn_limit, employee_limit, features), clients(business_name)",
    )
    .eq("status", "active");

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  const [{ data: txnOverageFee }, { data: employeeOverageFee }] =
    await Promise.all([
      supabase
        .from("billing_config")
        .select("amount")
        .eq("key", "bookkeeping_txn_overage")
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("billing_config")
        .select("amount")
        .eq("key", "payroll_employee_overage")
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const results: Array<{
    subscriptionId: string;
    invoiceId?: string;
    skipped?: string;
    error?: string;
  }> = [];

  for (const sub of subscriptions ?? []) {
    const plan = sub.plans as unknown as {
      price_monthly: string;
      price_annual_monthly: string;
      txn_limit: number | null;
      employee_limit: number | null;
      features: Record<string, unknown>;
    } | null;
    if (!plan) {
      results.push({ subscriptionId: sub.id, error: "Plan not found" });
      continue;
    }

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("period_start", sub.current_period_start)
      .maybeSingle();

    if (existing) {
      results.push({
        subscriptionId: sub.id,
        skipped: "already invoiced for this period",
      });
      continue;
    }

    const useLockedPrice =
      sub.locked_price !== null &&
      sub.price_locked_until !== null &&
      sub.price_locked_until >= today;
    const unitPrice = useLockedPrice
      ? money(sub.locked_price!)
      : money(
          sub.cycle === "annual"
            ? plan.price_annual_monthly
            : plan.price_monthly,
        );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        client_id: sub.client_id,
        subscription_id: sub.id,
        due_date: dueDate.toISOString().slice(0, 10),
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        status: "issued",
      })
      .select("id")
      .single();

    if (invError || !invoice) {
      results.push({
        subscriptionId: sub.id,
        error: invError?.message ?? "insert failed",
      });
      continue;
    }

    await supabase.from("invoice_lines").insert({
      invoice_id: invoice.id,
      kind: "subscription",
      description: `Subscription (${sub.cycle}) for ${sub.current_period_start} to ${sub.current_period_end}`,
      qty: "1",
      unit_price: toDbString(unitPrice),
    });

    const { data: unbilledFees } = await supabase
      .from("government_fees")
      .select(
        "id, agency, description, amount_at_cost, handling_fee, job_id, registration_jobs!inner(client_id)",
      )
      .eq("registration_jobs.client_id", sub.client_id)
      .is("billed_invoice_id", null);

    for (const fee of unbilledFees ?? []) {
      await supabase.from("invoice_lines").insert([
        {
          invoice_id: invoice.id,
          kind: "govt_fee",
          description: `${fee.agency} – ${fee.description} (at cost)`,
          qty: "1",
          unit_price: fee.amount_at_cost,
        },
        {
          invoice_id: invoice.id,
          kind: "handling_fee",
          description: `${fee.agency} – ${fee.description} (handling)`,
          qty: "1",
          unit_price: fee.handling_fee,
        },
      ]);
      await supabase
        .from("government_fees")
        .update({ billed_invoice_id: invoice.id })
        .eq("id", fee.id);
    }

    const overagePeriod = sub.current_period_start.slice(0, 7);

    if (plan.txn_limit !== null && txnOverageFee) {
      const { data: txnCount } = await supabase.rpc(
        "count_receipts_for_period",
        { p_client_id: sub.client_id, p_period: overagePeriod },
      );
      const overage = Math.max(0, (txnCount ?? 0) - plan.txn_limit);
      if (overage > 0) {
        await supabase.from("invoice_lines").insert({
          invoice_id: invoice.id,
          kind: "txn_overage",
          description: `Bookkeeping transactions over plan limit (${overagePeriod}, ${overage} over ${plan.txn_limit})`,
          qty: String(overage),
          unit_price: txnOverageFee.amount,
        });
      }
    }

    if (
      plan.employee_limit !== null &&
      plan.features?.payroll_locked !== true &&
      employeeOverageFee
    ) {
      const { count: employeeCount } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("client_id", sub.client_id)
        .eq("status", "active");
      const overage = Math.max(0, (employeeCount ?? 0) - plan.employee_limit);
      if (overage > 0) {
        await supabase.from("invoice_lines").insert({
          invoice_id: invoice.id,
          kind: "employee_overage",
          description: `Employees over plan limit (${overagePeriod}, ${overage} over ${plan.employee_limit})`,
          qty: String(overage),
          unit_price: employeeOverageFee.amount,
        });
      }
    }

    const nextStart = new Date(sub.current_period_end);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    if (sub.cycle === "annual") {
      nextEnd.setFullYear(nextEnd.getFullYear() + 1);
    } else {
      nextEnd.setMonth(nextEnd.getMonth() + 1);
    }
    nextEnd.setDate(nextEnd.getDate() - 1);

    await supabase
      .from("subscriptions")
      .update({
        current_period_start: nextStart.toISOString().slice(0, 10),
        current_period_end: nextEnd.toISOString().slice(0, 10),
      })
      .eq("id", sub.id);

    const { data: finalInvoice } = await supabase
      .from("invoices")
      .select("number, total, due_date")
      .eq("id", invoice.id)
      .single();
    const client = sub.clients as unknown as { business_name: string } | null;

    if (finalInvoice) {
      await queueNotificationToClientAdmins(supabase, {
        clientId: sub.client_id,
        template: "invoice_issued",
        payload: {
          business_name: client?.business_name ?? "",
          invoice_number: finalInvoice.number ?? "",
          amount: formatPeso(money(finalInvoice.total)),
          due_date: formatManila(finalInvoice.due_date),
        },
      });
    }

    results.push({ subscriptionId: sub.id, invoiceId: invoice.id });
  }

  return NextResponse.json({ generated: results });
}
