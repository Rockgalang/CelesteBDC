import { z } from "zod";

export const EMPLOYMENT_TYPES = [
  "regular",
  "probationary",
  "contractual",
  "part_time",
] as const;

export const createEmployeeSchema = z.object({
  clientId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Name is required."),
  position: z.string().trim().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  monthlyRate: z.coerce.number().nonnegative(),
  sssNo: z.string().trim().optional(),
  philhealthNo: z.string().trim().optional(),
  pagibigNo: z.string().trim().optional(),
  tin: z.string().trim().optional(),
  hireDate: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const createPayrollRunSchema = z.object({
  clientId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM."),
  payDate: z.string().min(1, "Pay date is required."),
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const updatePayslipSchema = z.object({
  payslipId: z.string().uuid(),
  basicPay: z.coerce.number().nonnegative(),
  overtimePay: z.coerce.number().nonnegative(),
  allowances: z.coerce.number().nonnegative(),
  sssEmployee: z.coerce.number().nonnegative(),
  sssEmployer: z.coerce.number().nonnegative(),
  philhealthEmployee: z.coerce.number().nonnegative(),
  philhealthEmployer: z.coerce.number().nonnegative(),
  pagibigEmployee: z.coerce.number().nonnegative(),
  pagibigEmployer: z.coerce.number().nonnegative(),
  withholdingTax: z.coerce.number().nonnegative(),
  otherDeductions: z.coerce.number().nonnegative(),
});
export type UpdatePayslipInput = z.infer<typeof updatePayslipSchema>;

export const processPayrollRunSchema = z.object({
  payrollRunId: z.string().uuid(),
  wagesAccountId: z.string().uuid(),
  employerContribAccountId: z.string().uuid(),
  whtPayableAccountId: z.string().uuid(),
  contributionsPayableAccountId: z.string().uuid(),
  cashAccountId: z.string().uuid(),
});
export type ProcessPayrollRunInput = z.infer<typeof processPayrollRunSchema>;
