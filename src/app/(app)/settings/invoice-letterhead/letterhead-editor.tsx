"use client";

import { useState, useTransition } from "react";

import { updateInvoiceLetterheadAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_QR_DATA_URL_BYTES } from "@/lib/validation/self-registration";
import type { InvoiceLetterheadRow } from "@/lib/supabase/types";

export function LetterheadEditor({
  letterhead,
}: {
  letterhead: InvoiceLetterheadRow;
}) {
  const [businessName, setBusinessName] = useState(letterhead.business_name);
  const [logoDataUrl, setLogoDataUrl] = useState(letterhead.logo_data_url ?? "");
  const [address, setAddress] = useState(letterhead.address ?? "");
  const [footerNote, setFooterNote] = useState(letterhead.footer_note ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_QR_DATA_URL_BYTES) {
      setError("Logo is too large (max 500KB). Try a smaller image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateInvoiceLetterheadAction({
        businessName,
        logoDataUrl: logoDataUrl || undefined,
        address: address || undefined,
        footerNote: footerNote || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="lh-name">Business name</Label>
          <Input
            id="lh-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lh-logo">Logo</Label>
          {logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- inline data URL
            <img
              src={logoDataUrl}
              alt="Logo preview"
              className="h-16 w-16 rounded-md border object-contain"
            />
          )}
          <Input
            id="lh-logo"
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lh-address">Address</Label>
          <Textarea
            id="lh-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lh-footer">Footer note</Label>
          <Textarea
            id="lh-footer"
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            rows={2}
            placeholder="Thank-you note, TIN, terms, etc."
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Saved.</p>}
        <Button size="sm" disabled={isPending} onClick={onSave}>
          Save letterhead
        </Button>
      </CardContent>
    </Card>
  );
}
