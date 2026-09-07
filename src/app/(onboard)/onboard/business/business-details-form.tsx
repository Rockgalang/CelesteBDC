"use client";

import { useState, useTransition } from "react";

import { updateBusinessDetailsAction } from "@/app/(onboard)/onboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientsRow } from "@/lib/supabase/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function BusinessDetailsForm({ client }: { client: ClientsRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tradeName: client.trade_name ?? "",
    tin: client.tin ?? "",
    rdoCode: client.rdo_code ?? "",
    fiscalYearEndMonth: client.fiscal_year_end_month,
    vatRegistered: client.vat_registered,
    dtiRegNo: client.dti_reg_no ?? "",
    secRegNo: client.sec_reg_no ?? "",
    mayorsPermitNo: client.mayors_permit_no ?? "",
    addressLine: client.address_line ?? "",
    barangay: client.barangay ?? "",
    city: client.city ?? "",
    province: client.province ?? "",
    postalCode: client.postal_code ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateBusinessDetailsAction(form);
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registration details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trade-name">Trade name (if different)</Label>
            <Input
              id="trade-name"
              value={form.tradeName}
              onChange={(e) => set("tradeName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tin">TIN</Label>
            <Input id="tin" value={form.tin} onChange={(e) => set("tin", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdo">RDO code</Label>
            <Input id="rdo" value={form.rdoCode} onChange={(e) => set("rdoCode", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscal-year">Fiscal year ends</Label>
            <select
              id="fiscal-year"
              value={form.fiscalYearEndMonth}
              onChange={(e) => set("fiscalYearEndMonth", Number(e.target.value))}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="vat"
              checked={form.vatRegistered}
              onCheckedChange={(c) => set("vatRegistered", c === true)}
            />
            <Label htmlFor="vat" className="font-normal">
              VAT-registered
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dti">DTI registration no.</Label>
            <Input id="dti" value={form.dtiRegNo} onChange={(e) => set("dtiRegNo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec">SEC registration no.</Label>
            <Input id="sec" value={form.secRegNo} onChange={(e) => set("secRegNo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mayors">Mayor&apos;s permit no.</Label>
            <Input
              id="mayors"
              value={form.mayorsPermitNo}
              onChange={(e) => set("mayorsPermitNo", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address line</Label>
            <Input
              id="address"
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barangay">Barangay</Label>
            <Input id="barangay" value={form.barangay} onChange={(e) => set("barangay", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City / municipality</Label>
            <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province">Province</Label>
            <Input id="province" value={form.province} onChange={(e) => set("province", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postal">Postal code</Label>
            <Input id="postal" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button onClick={onSubmit} disabled={isPending}>
        {isPending ? "Saving..." : "Continue to questionnaire"}
      </Button>
    </div>
  );
}
