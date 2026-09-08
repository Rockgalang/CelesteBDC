import "server-only";

/** Same header shape the client downloads as a template and the parser
 * below expects on upload — keep these in lockstep. */
export const IMPORT_CSV_HEADERS = [
  "date",
  "type",
  "description",
  "category",
  "amount",
] as const;

export function importCsvTemplate(): string {
  const header = IMPORT_CSV_HEADERS.join(",");
  const example = "2026-06-01,sale,Daily sales,sales,5000.00";
  return `${header}\n${example}\n`;
}

export type ParsedImportRow = {
  rowNumber: number;
  entryType: "sale" | "expense";
  entryDate: string;
  description: string;
  amount: number;
  category: string | null;
};

export type CsvParseResult =
  | { ok: true; rows: ParsedImportRow[] }
  | { ok: false; error: string };

/** Minimal CSV line splitter with double-quote support — good enough for
 * the fixed 5-column format this import expects, without pulling in a
 * dependency for it. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseImportCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { ok: false, error: "The file is empty." };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expectedIndex = (name: string) => header.indexOf(name);
  const dateIdx = expectedIndex("date");
  const typeIdx = expectedIndex("type");
  const descIdx = expectedIndex("description");
  const categoryIdx = expectedIndex("category");
  const amountIdx = expectedIndex("amount");

  if ([dateIdx, typeIdx, descIdx, amountIdx].some((i) => i === -1)) {
    return {
      ok: false,
      error: `Header must include: ${IMPORT_CSV_HEADERS.join(", ")}. Download the template to match the expected format.`,
    };
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rowNumber = i + 1; // 1-indexed, matches what a spreadsheet shows
    const date = cells[dateIdx]?.trim();
    const type = cells[typeIdx]?.trim().toLowerCase();
    const description = cells[descIdx]?.trim();
    const category = categoryIdx >= 0 ? cells[categoryIdx]?.trim() || null : null;
    const amountRaw = cells[amountIdx]?.trim();

    if (!date || !DATE_RE.test(date)) {
      return {
        ok: false,
        error: `Row ${rowNumber}: date must be YYYY-MM-DD, got "${date ?? ""}".`,
      };
    }
    if (type !== "sale" && type !== "expense") {
      return {
        ok: false,
        error: `Row ${rowNumber}: type must be "sale" or "expense", got "${type ?? ""}".`,
      };
    }
    if (!description) {
      return { ok: false, error: `Row ${rowNumber}: description is required.` };
    }
    const amount = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: `Row ${rowNumber}: amount must be a positive number, got "${amountRaw ?? ""}".`,
      };
    }

    rows.push({
      rowNumber,
      entryType: type,
      entryDate: date,
      description,
      amount,
      category,
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "No data rows found below the header." };
  }
  if (rows.length > 1000) {
    return { ok: false, error: "Max 1000 rows per import — split into smaller files." };
  }

  return { ok: true, rows };
}
