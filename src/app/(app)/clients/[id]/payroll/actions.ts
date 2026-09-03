"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { estimatePayslipDeductions } from "@/lib/payroll/computations";
import { money, toDbString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  createEmployeeSchema,
  createPayrollRunSchema,
  processPayrollRunSchema,
  updatePayslipSchema,
  type CreateEmployeeInput,
  type CreatePayrollRunInput,
  type ProcessPayrollRunInput,
  type UpdatePayslipInput,
} from "@/lib/validation/payroll";

export async function createEmployeeAction(
  input: CreateEmployeeInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    client_id: parsed.data.clientId,
    full_name: parsed.data.fullName,
    position: parsed.data.position ?? null,
    employment_type: parsed.data.employmentType,
    monthly_rate: toDbString(money(parsed.data.monthlyRate)),
    sss_no: parsed.data.sssNo ?? null,
    philhealth_no: parsed.data.philhealthNo ?? null,
    pagibig_no: parsed.data.pagibigNo ?? null,
    tin: parsed.data.tin ?? null,
    hire_date: parsed.data.hireDate ?? null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/payroll`);
  return { ok: true };
}

export async function setEmployeeStatusAction(
  clientId: string,
  employeeId: string,
  status: "active" | "on_leave" | "separated",
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      status,
      separation_date:
        status === "separated"
          ? new Date().toISOString().slice(0, 10)
          : null,
    })
    .eq("id", employeeId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/payroll`);
  return { ok: true };
}

export async function createPayrollRunAction(
  input: CreatePayrollRunInput,
): Promise<ActionResult & { runId?: string }> {
  await requireRole("owner", "staff");

  const parsed = createPayrollRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data: run, error } = await supabase.rpc("create_payroll_run", {
    p_client_id: parsed.data.clientId,
    p_period: parsed.data.period,
    p_pay_date: parsed.data.payDate,
  });
  if (error || !run) {
    return { ok: false, error: error?.message ?? "Could not create payroll run." };
  }

  const { data: payslips } = await supabase
    .from("payslips")
    .select("id, basic_pay")
    .eq("payroll_run_id", run.id);

  for (const payslip of payslips ?? []) {
    const estimate = estimatePayslipDeductions(money(payslip.basic_pay));
    await supabase
      .from("payslips")
      .update({
        sss_employee: estimate.sssEmployee,
        sss_employer: estimate.sssEmployer,
        philhealth_employee: estimate.philhealthEmployee,
        philhealth_employer: estimate.philhealthEmployer,
        pagibig_employee: estimate.pagibigEmployee,
        pagibig_employer: estimate.pagibigEmployer,
        withholding_tax: estimate.withholdingTax,
      })
      .eq("id", payslip.id);
  }

  revalidatePath(`/clients/${parsed.data.clientId}/payroll`);
  redirect(`/clients/${parsed.data.clientId}/payroll/${run.id}`);
}

export async function updatePayslipAction(
  clientId: string,
  runId: string,
  input: UpdatePayslipInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = updatePayslipSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payslips")
    .update({
      basic_pay: toDbString(money(parsed.data.basicPay)),
      overtime_pay: toDbString(money(parsed.data.overtimePay)),
      allowances: toDbString(money(parsed.data.allowances)),
      sss_employee: toDbString(money(parsed.data.sssEmployee)),
      sss_employer: toDbString(money(parsed.data.sssEmployer)),
      philhealth_employee: toDbString(money(parsed.data.philhealthEmployee)),
      philhealth_employer: toDbString(money(parsed.data.philhealthEmployer)),
      pagibig_employee: toDbString(money(parsed.data.pagibigEmployee)),
      pagibig_employer: toDbString(money(parsed.data.pagibigEmployer)),
      withholding_tax: toDbString(money(parsed.data.withholdingTax)),
      other_deductions: toDbString(money(parsed.data.otherDeductions)),
    })
    .eq("id", parsed.data.payslipId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/payroll/${runId}`);
  return { ok: true };
}

export async function processPayrollRunAction(
  input: ProcessPayrollRunInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = processPayrollRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("process_payroll_run", {
    p_payroll_run_id: parsed.data.payrollRunId,
    p_wages_account_id: parsed.data.wagesAccountId,
    p_employer_contrib_account_id: parsed.data.employerContribAccountId,
    p_wht_payable_account_id: parsed.data.whtPayableAccountId,
    p_contributions_payable_account_id: parsed.data.contributionsPayableAccountId,
    p_cash_account_id: parsed.data.cashAccountId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
