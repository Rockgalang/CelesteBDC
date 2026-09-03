import { money, roundPeso, toDbString, type Money } from "@/lib/money";

/**
 * Philippine government-contribution and withholding-tax estimates for a
 * monthly payslip. These are a starting point for the reviewer to check
 * and correct before a payroll run is processed — not the official
 * bracket schedules.
 *
 * ⚠️ SSS, PhilHealth, and Pag-IBIG (HDMF) formulas below are simplified
 * flat-rate approximations of the current published rates, not the
 * official Monthly Salary Credit / contribution bracket tables (which
 * step in narrower salary bands than a flat percentage). They will be
 * close for most salaries but not exact at bracket boundaries. Verify
 * against the current SSS/PhilHealth/HDMF circular before relying on
 * this for an actual remittance — Celeste BDC is not a CPA firm (build
 * spec §2.2).
 *
 * The withholding tax table below IS the official BIR monthly
 * withholding tax table under the TRAIN law (RR 11-2018 as amended),
 * which has been stable since the 2023 rate step-down and is not a
 * simplification.
 */

export type ContributionEstimate = {
  sssEmployee: string;
  sssEmployer: string;
  philhealthEmployee: string;
  philhealthEmployer: string;
  pagibigEmployee: string;
  pagibigEmployer: string;
  withholdingTax: string;
};

const SSS_MIN_MSC = 5000;
const SSS_MAX_MSC = 30000;
const SSS_EMPLOYEE_RATE = 0.045;
const SSS_EMPLOYER_RATE = 0.095;
const SSS_EC_CONTRIBUTION = 10; // flat Employees' Compensation contribution

const PHILHEALTH_FLOOR = 10000;
const PHILHEALTH_CEILING = 100000;
const PHILHEALTH_SHARE_RATE = 0.025; // 2.5% each side (5% total premium)

const PAGIBIG_BASE_CAP = 5000;
const PAGIBIG_LOW_INCOME_THRESHOLD = 1500;
const PAGIBIG_LOW_INCOME_EMPLOYEE_RATE = 0.01;
const PAGIBIG_EMPLOYEE_RATE = 0.02;
const PAGIBIG_EMPLOYER_RATE = 0.02;

function estimateSss(monthlyPay: Money) {
  const msc = money(monthlyPay).clamp(SSS_MIN_MSC, SSS_MAX_MSC);
  const employee = roundPeso(msc.times(SSS_EMPLOYEE_RATE));
  const employer = roundPeso(msc.times(SSS_EMPLOYER_RATE)).plus(SSS_EC_CONTRIBUTION);
  return { employee, employer };
}

function estimatePhilhealth(monthlyPay: Money) {
  const base = money(monthlyPay).clamp(PHILHEALTH_FLOOR, PHILHEALTH_CEILING);
  const share = roundPeso(base.times(PHILHEALTH_SHARE_RATE));
  return { employee: share, employer: share };
}

function estimatePagibig(monthlyPay: Money) {
  const base = money(monthlyPay).clamp(0, PAGIBIG_BASE_CAP);
  const employeeRate =
    monthlyPay.lte(PAGIBIG_LOW_INCOME_THRESHOLD)
      ? PAGIBIG_LOW_INCOME_EMPLOYEE_RATE
      : PAGIBIG_EMPLOYEE_RATE;
  const employee = roundPeso(base.times(employeeRate));
  const employer = roundPeso(base.times(PAGIBIG_EMPLOYER_RATE));
  return { employee, employer };
}

// BIR monthly withholding tax table (TRAIN law, RR 11-2018 as amended).
// Bracket floors, base tax at the floor, and marginal rate above it.
const WITHHOLDING_BRACKETS: {
  floor: number;
  baseTax: number;
  rate: number;
}[] = [
  { floor: 0, baseTax: 0, rate: 0 },
  { floor: 20_833, baseTax: 0, rate: 0.15 },
  { floor: 33_333, baseTax: 1_875, rate: 0.2 },
  { floor: 66_667, baseTax: 8_541.8, rate: 0.25 },
  { floor: 166_667, baseTax: 33_541.8, rate: 0.3 },
  { floor: 666_667, baseTax: 183_541.8, rate: 0.35 },
];

function estimateWithholdingTax(taxableIncome: Money): Money {
  if (taxableIncome.lte(0)) return money(0);

  let bracket = WITHHOLDING_BRACKETS[0];
  for (const b of WITHHOLDING_BRACKETS) {
    if (taxableIncome.gte(b.floor)) bracket = b;
    else break;
  }

  const excess = taxableIncome.minus(bracket.floor);
  return roundPeso(money(bracket.baseTax).plus(excess.times(bracket.rate)));
}

/**
 * Estimate every deduction for one payslip given gross monthly pay.
 * Withholding tax is computed on gross pay net of the mandatory
 * employee-side contributions, per standard BIR practice.
 */
export function estimatePayslipDeductions(grossPay: Money): ContributionEstimate {
  const sss = estimateSss(grossPay);
  const philhealth = estimatePhilhealth(grossPay);
  const pagibig = estimatePagibig(grossPay);

  const taxableIncome = grossPay
    .minus(sss.employee)
    .minus(philhealth.employee)
    .minus(pagibig.employee);
  const withholdingTax = estimateWithholdingTax(taxableIncome);

  return {
    sssEmployee: toDbString(sss.employee),
    sssEmployer: toDbString(sss.employer),
    philhealthEmployee: toDbString(philhealth.employee),
    philhealthEmployer: toDbString(philhealth.employer),
    pagibigEmployee: toDbString(pagibig.employee),
    pagibigEmployer: toDbString(pagibig.employer),
    withholdingTax: toDbString(withholdingTax),
  };
}
