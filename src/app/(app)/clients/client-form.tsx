"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  createClientAction,
  updateClientAction,
} from "@/app/(app)/clients/actions";
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
import {
  CLIENT_STATUSES,
  ENTITY_TYPES,
  TAX_TYPES,
  clientSchema,
  type ClientInput,
} from "@/lib/validation/clients";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ClientForm({
  clientId,
  defaultValues,
}: {
  clientId?: string;
  defaultValues?: Partial<ClientInput>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      entityType: "sole_proprietor",
      taxType: "percentage",
      fiscalYearEndMonth: 12,
      vatRegistered: false,
      status: "prospect",
      ...defaultValues,
    },
  });

  const onSubmit = (data: ClientInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = clientId
        ? await updateClientAction(clientId, data)
        : await createClientAction(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      if (clientId) router.refresh();
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" {...register("businessName")} />
            {errors.businessName && (
              <p className="text-destructive text-sm">
                {errors.businessName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tradeName">Trade name</Label>
            <Input id="tradeName" {...register("tradeName")} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(v) =>
                setValue("status", v as ClientInput["status"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Entity type</Label>
            <Select
              value={watch("entityType")}
              onValueChange={(v) =>
                setValue("entityType", v as ClientInput["entityType"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tax type</Label>
            <Select
              value={watch("taxType")}
              onValueChange={(v) =>
                setValue("taxType", v as ClientInput["taxType"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fiscal year end</Label>
            <Select
              value={String(watch("fiscalYearEndMonth"))}
              onValueChange={(v) => setValue("fiscalYearEndMonth", Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="vatRegistered"
              checked={watch("vatRegistered")}
              onCheckedChange={(v) => setValue("vatRegistered", v === true)}
            />
            <Label htmlFor="vatRegistered">VAT registered</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tin">TIN</Label>
            <Input id="tin" {...register("tin")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rdoCode">RDO code</Label>
            <Input id="rdoCode" {...register("rdoCode")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dtiRegNo">DTI registration no.</Label>
            <Input id="dtiRegNo" {...register("dtiRegNo")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secRegNo">SEC registration no.</Label>
            <Input id="secRegNo" {...register("secRegNo")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mayorsPermitNo">Mayor&apos;s permit no.</Label>
            <Input id="mayorsPermitNo" {...register("mayorsPermitNo")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine">Address</Label>
            <Input id="addressLine" {...register("addressLine")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barangay">Barangay</Label>
            <Input id="barangay" {...register("barangay")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register("city")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input id="province" {...register("province")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" {...register("postalCode")} />
          </div>
          {formError && (
            <p className="text-destructive text-sm sm:col-span-2">
              {formError}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving..."
              : clientId
                ? "Save changes"
                : "Create client"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
