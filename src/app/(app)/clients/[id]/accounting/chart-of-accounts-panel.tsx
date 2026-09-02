"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  createAccountAction,
  seedChartOfAccountsAction,
  setAccountActiveAction,
} from "@/app/(app)/clients/[id]/accounting/actions";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  createAccountSchema,
  type CreateAccountInput,
} from "@/lib/validation/accounting";
import type { ChartOfAccountsRow } from "@/lib/supabase/types";

export function ChartOfAccountsPanel({
  clientId,
  accounts,
}: {
  clientId: string;
  accounts: ChartOfAccountsRow[];
}) {
  const [isSeeding, startSeed] = useTransition();
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
  const [isToggling, startToggle] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { clientId, type: "expense", normalBalance: "debit" },
  });

  const onSeed = () => {
    setError(null);
    startSeed(async () => {
      const result = await seedChartOfAccountsAction(clientId);
      if (!result.ok) setError(result.error);
    });
  };

  const onToggle = (accountId: string, active: boolean) => {
    setError(null);
    setIsTogglingId(accountId);
    startToggle(async () => {
      const result = await setAccountActiveAction(clientId, accountId, active);
      if (!result.ok) setError(result.error);
    });
  };

  const onCreate = (data: CreateAccountInput) => {
    setError(null);
    createAccountAction(data).then((result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset({
        clientId,
        code: "",
        name: "",
        type: "expense",
        normalBalance: "debit",
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart of accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              No accounts yet. Seed the default chart of accounts for this
              client&apos;s entity type, then customize as needed. Verify
              against a CPA-reviewed chart before relying on it operationally.
            </p>
            <Button size="sm" disabled={isSeeding} onClick={onSeed}>
              {isSeeding ? "Seeding..." : "Seed default chart of accounts"}
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Normal balance</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="capitalize">{a.type}</TableCell>
                  <TableCell className="capitalize">
                    {a.normal_balance}
                  </TableCell>
                  <TableCell>
                    {a.is_system && <Badge variant="secondary">System</Badge>}
                    {!a.active && <Badge variant="outline">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isToggling && isTogglingId === a.id}
                      onClick={() => onToggle(a.id, !a.active)}
                    >
                      {a.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Separator />

        <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
          <input type="hidden" {...register("clientId")} value={clientId} />
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="acct-code">Code</Label>
              <Input id="acct-code" {...register("code")} />
              {errors.code && (
                <p className="text-destructive text-sm">
                  {errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-name">Name</Label>
              <Input id="acct-name" {...register("name")} />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(v) =>
                  setValue("type", v as CreateAccountInput["type"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Normal balance</Label>
              <Select
                value={watch("normalBalance")}
                onValueChange={(v) =>
                  setValue(
                    "normalBalance",
                    v as CreateAccountInput["normalBalance"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NORMAL_BALANCES.map((b) => (
                    <SelectItem key={b} value={b} className="capitalize">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
