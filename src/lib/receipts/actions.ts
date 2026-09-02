"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { extractReceiptData } from "@/lib/receipts/ocr";
import { requireRole } from "@/lib/auth/current-profile";
import { money, toDbString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_RECEIPT_UPLOAD_BYTES,
  uploadReceiptSchema,
} from "@/lib/validation/accounting";

const BUCKET = "receipts";
const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes, same policy as documents

export async function uploadReceiptAction(
  formData: FormData,
): Promise<ActionResult & { receiptId?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (file.size > MAX_RECEIPT_UPLOAD_BYTES) {
    return { ok: false, error: "File is larger than 15MB." };
  }

  const parsed = uploadReceiptSchema.safeParse({
    clientId: formData.get("clientId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const mime = file.type || "application/octet-stream";
  const storagePath = `${parsed.data.clientId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: mime });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: receipt, error: insertError } = await supabase
    .from("receipts")
    .insert({
      client_id: parsed.data.clientId,
      uploaded_by: user?.id ?? null,
      storage_path: storagePath,
      mime,
      bytes: file.size,
      sha256,
      status: "processing",
    })
    .select("id")
    .single();
  if (insertError || !receipt) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: `Could not save receipt record: ${insertError?.message ?? "unknown error"}`,
    };
  }

  const extraction = await extractReceiptData(bytes, mime);
  if (extraction.ok) {
    await supabase
      .from("receipts")
      .update({
        status: "needs_review",
        ocr_raw: extraction.data.raw,
        ocr_confidence: {
          vendor_name: extraction.data.confidence.vendorName,
          receipt_date: extraction.data.confidence.receiptDate,
          amount: extraction.data.confidence.amount,
        },
        vendor_name: extraction.data.vendorName,
        receipt_date: extraction.data.receiptDate,
        amount:
          extraction.data.amount !== null
            ? toDbString(money(extraction.data.amount))
            : null,
        currency: extraction.data.currency ?? "PHP",
        category: extraction.data.category,
      })
      .eq("id", receipt.id);
  } else {
    await supabase
      .from("receipts")
      .update({ status: "needs_review", ocr_error: extraction.error })
      .eq("id", receipt.id);
  }

  revalidatePath("/receipts");
  revalidatePath("/receipts/review");
  return { ok: true, receiptId: receipt.id };
}

export async function getSignedReceiptUrlAction(
  receiptId: string,
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();

  const { data: receipt, error: fetchError } = await supabase
    .from("receipts")
    .select("storage_path")
    .eq("id", receiptId)
    .single();
  if (fetchError || !receipt) {
    return { ok: false, error: "Receipt not found." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(receipt.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return { ok: false, error: "Could not generate a link for this file." };
  }

  return { ok: true, url: data.signedUrl };
}

export async function reprocessReceiptOcrAction(
  receiptId: string,
): Promise<ActionResult> {
  await requireRole("owner", "staff");
  const supabase = await createClient();

  const { data: receipt, error: fetchError } = await supabase
    .from("receipts")
    .select("storage_path, mime")
    .eq("id", receiptId)
    .single();
  if (fetchError || !receipt) {
    return { ok: false, error: "Receipt not found." };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(receipt.storage_path);
  if (downloadError || !file) {
    return { ok: false, error: "Could not load the receipt image." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extraction = await extractReceiptData(bytes, receipt.mime);
  if (!extraction.ok) {
    await supabase
      .from("receipts")
      .update({ ocr_error: extraction.error })
      .eq("id", receiptId);
    return { ok: false, error: extraction.error };
  }

  await supabase
    .from("receipts")
    .update({
      ocr_raw: extraction.data.raw,
      ocr_confidence: {
        vendor_name: extraction.data.confidence.vendorName,
        receipt_date: extraction.data.confidence.receiptDate,
        amount: extraction.data.confidence.amount,
      },
      ocr_error: null,
      vendor_name: extraction.data.vendorName,
      receipt_date: extraction.data.receiptDate,
      amount:
        extraction.data.amount !== null
          ? toDbString(money(extraction.data.amount))
          : null,
      currency: extraction.data.currency ?? "PHP",
      category: extraction.data.category,
    })
    .eq("id", receiptId);

  revalidatePath(`/receipts/review/${receiptId}`);
  return { ok: true };
}
