import Decimal from "decimal.js";

/**
 * Money handling per build spec §3: never use JavaScript floats for money.
 * All monetary Postgres columns are numeric(14,2) and come back from
 * postgrest as strings — wrap them in Decimal immediately and only ever
 * do arithmetic through Decimal. Convert to a plain string (never Number)
 * when writing back to the database.
 */

export type Money = Decimal;

export function money(value: string | number | Decimal): Money {
  return new Decimal(value);
}

export const ZERO: Money = new Decimal(0);

/** Round to 2 decimal places using standard "round half up", the convention
 * BIR keying sheets and PHP centavo amounts expect. */
export function roundPeso(value: Money): Money {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Serialize for a numeric(14,2) column / API payload. Never call
 * `.toNumber()` on a Money value that will be persisted or compared. */
export function toDbString(value: Money): string {
  return roundPeso(value).toFixed(2);
}
