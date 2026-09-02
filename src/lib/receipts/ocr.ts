import "server-only";

/**
 * Claude vision extraction for receipt photos (build spec §7.7). No queue
 * or worker infrastructure exists in this build, so extraction runs
 * synchronously right after upload, inside the same server action —
 * consistent with the rest of this codebase's deliberately manual/simple
 * infra choices (no BIR API, no payment gateway). If it's slow or the
 * model is unavailable, the receipt still lands in the review queue as
 * `needs_review` with `ocr_error` set; a human fills in the fields by hand.
 */

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ReceiptExtraction = {
  vendorName: string | null;
  receiptDate: string | null; // YYYY-MM-DD
  amount: number | null;
  currency: string | null;
  category: string | null;
  confidence: {
    vendorName: number | null;
    receiptDate: number | null;
    amount: number | null;
  };
  raw: Record<string, unknown>;
};

export type OcrResult =
  | { ok: true; data: ReceiptExtraction }
  | { ok: false; error: string };

const EXTRACTION_PROMPT = `You are extracting structured data from a photo of a Philippine business receipt or invoice for bookkeeping purposes. Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{
  "vendor_name": string | null,
  "receipt_date": string | null,   // ISO date YYYY-MM-DD, the transaction date on the receipt
  "amount": number | null,          // the total amount paid, as a plain number (no currency symbol, no commas)
  "currency": string | null,        // ISO 4217 code, e.g. "PHP"; assume "PHP" if unclear from a Philippine receipt
  "category": string | null,        // a short generic expense category guess, e.g. "Office Supplies", "Transportation", "Utilities", "Meals", "Professional Fees"
  "confidence": {
    "vendor_name": number,          // 0-1, your confidence in vendor_name
    "receipt_date": number,         // 0-1
    "amount": number                // 0-1
  }
}

If the image is not a legible receipt/invoice, set every field to null and every confidence to 0. Never invent a value you can't read.`;

export async function extractReceiptData(
  bytes: Uint8Array,
  mime: string,
): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OCR is not configured (no ANTHROPIC_API_KEY)." };
  }
  if (!SUPPORTED_IMAGE_MIME.has(mime)) {
    return {
      ok: false,
      error: `Unsupported image type for OCR: ${mime}. Enter details manually.`,
    };
  }

  const base64 = Buffer.from(bytes).toString("base64");

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              {
                type: "image",
                source: { type: "base64", media_type: mime, data: base64 },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return {
      ok: false,
      error: `OCR request failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `OCR API returned ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text;
  if (typeof text !== "string") {
    return { ok: false, error: "OCR response had no text content." };
  }

  let parsed: Record<string, unknown>;
  try {
    // Strip a stray ```json fence if the model added one anyway.
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "Could not parse OCR response as JSON." };
  }

  const confidence = (parsed.confidence ?? {}) as Record<string, unknown>;

  return {
    ok: true,
    data: {
      vendorName: typeof parsed.vendor_name === "string" ? parsed.vendor_name : null,
      receiptDate:
        typeof parsed.receipt_date === "string" ? parsed.receipt_date : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      category: typeof parsed.category === "string" ? parsed.category : null,
      confidence: {
        vendorName:
          typeof confidence.vendor_name === "number"
            ? confidence.vendor_name
            : null,
        receiptDate:
          typeof confidence.receipt_date === "number"
            ? confidence.receipt_date
            : null,
        amount:
          typeof confidence.amount === "number" ? confidence.amount : null,
      },
      raw: parsed,
    },
  };
}
