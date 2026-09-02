"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createBankAccountAction } from "@/app/(app)/clients/[id]/accounting/bank/actions";
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
import {
  createBankAccountSchema,
  type CreateBankAccountInput,
} from "@/lib/validation/accounting";
import type { BankAccountsRow, ChartOfAccountsRow } from "@/lib/supabase/types";

export function BankAccountsPanel({
  clientId,
  bankAccounts,
  cashAccounts,
}: {
  clientId: string;
  bankAccounts: BankAccountsRow[];
  cashAccounts: ChartOfAccountsRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateBankAccountInput>({
    resolver: zodResolver(createBankAccountSchema),
    defaultValues: { clientId },
  });
  const [, startSubmit] = useTransition();

  const onCreate = (data: CreateBankAccountInput) => {
    setError(null);
    startSubmit(async () => {
      const result = await createBankAccountAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset({ clientId, bankName: "", accountName: "" });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bankAccounts.length > 0 ? (
          <ul className="space-y-2">
            {bankAccounts.map((b) => (
              <li key={b.id} className="text-sm">
                <Link
                  href={`/clients/${clientId}/accounting/bank/${b.id}`}
                  className="font-medium hover:underline"
                >
                  {b.bank_name} — {b.account_name}
                </Link>
                {b.account_number_last4 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ····{b.account_number_last4}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No bank accounts yet.
          </p>
        )}

        <Separator />

        <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank-name">Bank</Label>
              <Input id="bank-name" {...register("bankName")} />
              {errors.bankName && (
                <p className="text-destructive text-sm">
                  {errors.bankName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Account name</Label>
              <Input id="account-name" {...register("accountName")} />
              {errors.accountName && (
                <p className="text-destructive text-sm">
                  {errors.accountName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last4">Last 4 digits (optional)</Label>
              <Input id="last4" maxLength={4} {...register("accountNumberLast4")} />
            </div>
            <div className="space-y-1.5">
              <Label>GL account (Cash in Bank)</Label>
              <Select
                value={watch("glAccountId") ?? ""}
                onValueChange={(v) => setValue("glAccountId", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add bank account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
