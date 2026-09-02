"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_UPLOAD_BYTES,
  uploadDocumentSchema,
} from "@/lib/validation/documents";

const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes, per build spec §2.3

export async function uploadDocumentAction(
  formData: FormData,
): Promise<ActionResult & { documentId?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is larger than 25MB." };
  }

  const parsed = uploadDocumentSchema.safeParse({
    clientId: formData.get("clientId"),
    category: formData.get("category"),
    issuedDate: formData.get("issuedDate") || undefined,
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // Client-scoped folder — required by the storage RLS policy, which
  // matches (storage.foldername(name))[1] against the caller's client_id.
  const storagePath = `${parsed.data.clientId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      client_id: parsed.data.clientId,
      category: parsed.data.category,
      filename: file.name,
      storage_path: storagePath,
      mime: file.type || "application/octet-stream",
      bytes: file.size,
      sha256,
      source: "portal",
      issued_date: parsed.data.issuedDate ?? null,
      expires_at: parsed.data.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (insertError || !document) {
    // Row insert failed after the file landed in storage (e.g. RLS
    // rejected the client_id) — remove the orphaned object rather than
    // leaving storage and the documents table out of sync.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: `Could not save document record: ${insertError?.message ?? "unknown error"}`,
    };
  }

  revalidatePath(`/clients/${parsed.data.clientId}`);
  revalidatePath("/documents");
  return { ok: true, documentId: document.id };
}

export async function getSignedDocumentUrlAction(
  documentId: string,
): Promise<ActionResult & { url?: string }> {
  const supabase = await createClient();

  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (fetchError || !document) {
    return { ok: false, error: "Document not found." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return { ok: false, error: "Could not generate a link for this file." };
  }

  return { ok: true, url: data.signedUrl };
}
