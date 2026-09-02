import { formatInTimeZone } from "date-fns-tz";
import type { Money } from "@/lib/money";
import { roundPeso } from "@/lib/money";

export const MANILA_TZ = "Asia/Manila";

/** Format a Decimal money value as PHP currency, e.g. "₱1,234.56". */
export function formatPeso(value: Money): string {
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundPeso(value).toNumber());
  return `₱${formatted}`;
}

/** Render a timestamptz value in Asia/Manila time. `pattern` uses
 * date-fns tokens, e.g. "MMM d, yyyy" or "MMM d, yyyy h:mm a". */
export function formatManila(
  value: string | Date,
  pattern = "MMM d, yyyy",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, MANILA_TZ, pattern);
}
