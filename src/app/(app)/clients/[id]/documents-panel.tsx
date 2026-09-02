"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLinkIcon } from "lucide-react";

import {
  getSignedDocumentUrlAction,
  uploadDocumentAction,
} from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatManila } from "@/lib/format";
import { DOCUMENT_CATEGORIES } from "@/lib/validation/documents";
import type { DocumentsRow } from "@/lib/supabase/types";

export function DocumentsPanel({
  clientId,
  documents,
}: {
  clientId: string;
  documents: DocumentsRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<string>("receipt");
  const [isUploading, startUpload] = useTransition();
  const [isOpening, startOpening] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const onUpload = (formData: FormData) => {
    setError(null);
    startUpload(async () => {
      const result = await uploadDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  };

  const onView = (documentId: string) => {
    setError(null);
    setOpeningId(documentId);
    startOpening(async () => {
      const result = await getSignedDocumentUrlAction(documentId);
      if (!result.ok || !result.url) {
        setError(result.ok ? "Could not open this file." : result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{doc.filename}</div>
                  <div className="text-muted-foreground text-xs">
                    {doc.category.replace(/_/g, " ")} · uploaded{" "}
                    {formatManila(doc.created_at)}
                    {doc.expires_at &&
                      ` · expires ${formatManila(doc.expires_at)}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isOpening && openingId === doc.id}
                  onClick={() => onView(doc.id)}
                >
                  <ExternalLinkIcon />
                  View
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No documents uploaded yet.
          </p>
        )}

        <Separator />

        <form ref={formRef} action={onUpload} className="space-y-3">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="category" value={category} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="file">File</Label>
              <Input id="file" name="file" type="file" required />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="sm" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload document"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
