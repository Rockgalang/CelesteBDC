"use client";

import { useState, useTransition } from "react";

import { updateEmailTemplateAction } from "@/app/(app)/settings/email-templates/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailTemplatesRow } from "@/lib/supabase/types";

export function TemplateEditor({ template }: { template: EmailTemplatesRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [bodyText, setBodyText] = useState(template.body_text);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm">{template.key}</CardTitle>
        {template.description && (
          <CardDescription>{template.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`subject-${template.key}`}>Subject</Label>
          <Input
            id={`subject-${template.key}`}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`body-${template.key}`}>Body</Label>
          <textarea
            id={`body-${template.key}`}
            className="border-input focus-visible:ring-ring min-h-32 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
            value={bodyText}
            onChange={(e) => {
              setBodyText(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && <p className="text-success text-sm">Saved.</p>}
      </CardContent>
      <CardFooter>
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await updateEmailTemplateAction(
                template.key,
                subject,
                bodyText,
              );
              if (!result.ok) setError(result.error);
              else setSaved(true);
            })
          }
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
