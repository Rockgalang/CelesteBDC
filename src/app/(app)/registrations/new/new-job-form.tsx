"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createJobAction } from "@/app/(app)/registrations/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JOB_TYPE_LABELS, JOB_TYPES } from "@/lib/validation/registration";

export function NewJobForm({
  clients,
}: {
  clients: { id: string; business_name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [jobType, setJobType] = useState("");
  const [isRenewal, setIsRenewal] = useState(false);
  const [targetDate, setTargetDate] = useState("");

  const onSubmit = () => {
    setError(null);
    if (!clientId || !jobType) {
      setError("Choose a client and a registration type.");
      return;
    }
    startTransition(async () => {
      const result = await createJobAction({
        clientId,
        jobType: jobType as (typeof JOB_TYPES)[number],
        isRenewal,
        targetDate: targetDate || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/registrations/${result.id}`);
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Registration type</Label>
          <Select value={jobType} onValueChange={setJobType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {JOB_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date (optional)</Label>
          <Input
            id="targetDate"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="isRenewal"
            checked={isRenewal}
            onCheckedChange={(v) => setIsRenewal(v === true)}
          />
          <Label htmlFor="isRenewal">This is a renewal</Label>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? "Creating..." : "Create job"}
        </Button>
      </CardFooter>
    </Card>
  );
}
