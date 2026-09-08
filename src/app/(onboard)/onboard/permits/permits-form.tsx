"use client";

import { useState, useTransition } from "react";

import {
  completePermitsStepAction,
  requestPermitRegistrationAction,
} from "@/app/(onboard)/onboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { uploadDocumentAction } from "@/lib/documents/actions";
import type { DocumentCategory } from "@/lib/validation/documents";
import type { JobType } from "@/lib/supabase/types";

type Item = { jobType: JobType; label: string; category: DocumentCategory };

export function PermitsForm({
  items,
  existingJobs,
  existingDocuments,
  clientId,
}: {
  items: Item[];
  existingJobs: { job_type: JobType; status: string }[];
  existingDocuments: { id: string; category: string; filename: string }[];
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requestedNow, setRequestedNow] = useState<Set<JobType>>(new Set());
  const [uploadedNow, setUploadedNow] = useState<Record<string, string>>({});

  const isRequested = (jobType: JobType) =>
    requestedNow.has(jobType) ||
    existingJobs.some(
      (j) => j.job_type === jobType && !["cancelled"].includes(j.status),
    );

  const uploadedFilename = (item: Item) =>
    uploadedNow[item.jobType] ??
    existingDocuments.find((d) => d.category === item.category)?.filename;

  const onRequest = (jobType: JobType) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPermitRegistrationAction(jobType);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRequestedNow((prev) => new Set(prev).add(jobType));
    });
  };

  const onUpload = (item: Item, file: File | null) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("clientId", clientId);
      formData.set("category", item.category);
      const result = await uploadDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUploadedNow((prev) => ({ ...prev, [item.jobType]: file.name }));
    });
  };

  const onContinue = () => {
    setError(null);
    startTransition(async () => {
      const result = await completePermitsStepAction();
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const requested = isRequested(item.jobType);
        const filename = uploadedFilename(item);
        return (
          <Card key={item.jobType}>
            <CardHeader>
              <CardTitle className="text-base">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requested ? (
                <Badge variant="secondary">
                  Requested — Celeste BDC will process this
                </Badge>
              ) : filename ? (
                <Badge variant="secondary">Uploaded: {filename}</Badge>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    className="max-w-xs"
                    disabled={isPending}
                    onChange={(e) => onUpload(item, e.target.files?.[0] ?? null)}
                  />
                  <span className="text-muted-foreground text-xs">or</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => onRequest(item.jobType)}
                  >
                    I don&apos;t have this — register it for me
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={onContinue} disabled={isPending}>
        {isPending ? "Saving..." : "Continue to questionnaire"}
      </Button>
      <p className="text-muted-foreground text-xs">
        You can also skip any of these for now and finish them later from
        your dashboard.
      </p>
    </div>
  );
}
