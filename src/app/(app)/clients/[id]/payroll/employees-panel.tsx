"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  createEmployeeAction,
  setEmployeeStatusAction,
} from "@/app/(app)/clients/[id]/payroll/actions";
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
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import {
  EMPLOYMENT_TYPES,
  createEmployeeSchema,
  type CreateEmployeeInput,
} from "@/lib/validation/payroll";
import type { EmployeesRow } from "@/lib/supabase/types";

export function EmployeesPanel({
  clientId,
  employees,
  employeeLimit,
}: {
  clientId: string;
  employees: EmployeesRow[];
  employeeLimit: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
  const [isToggling, startToggle] = useTransition();

  const activeCount = employees.filter((e) => e.status === "active").length;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { clientId, employmentType: "regular" },
  });

  const onCreate = (data: CreateEmployeeInput) => {
    setError(null);
    startSubmit(async () => {
      const result = await createEmployeeAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset({ clientId, employmentType: "regular" });
    });
  };

  const onSetStatus = (
    employeeId: string,
    status: "active" | "on_leave" | "separated",
  ) => {
    setError(null);
    setIsTogglingId(employeeId);
    startToggle(async () => {
      const result = await setEmployeeStatusAction(clientId, employeeId, status);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Employees
          {employeeLimit !== null && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {activeCount} / {employeeLimit} on plan
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {employees.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Monthly rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.full_name}</TableCell>
                  <TableCell>{e.position ?? "—"}</TableCell>
                  <TableCell className="capitalize">
                    {e.employment_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{formatPeso(money(e.monthly_rate))}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.status === "active"
                          ? "success"
                          : e.status === "on_leave"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {e.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {e.status !== "separated" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isToggling && isTogglingId === e.id}
                        onClick={() =>
                          onSetStatus(
                            e.id,
                            e.status === "active" ? "on_leave" : "active",
                          )
                        }
                      >
                        {e.status === "active" ? "Set on leave" : "Reactivate"}
                      </Button>
                    )}
                    {e.status !== "separated" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isToggling && isTogglingId === e.id}
                        onClick={() => onSetStatus(e.id, "separated")}
                      >
                        Separate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No employees yet.</p>
        )}

        <Separator />

        <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full name</Label>
              <Input id="emp-name" {...register("fullName")} />
              {errors.fullName && (
                <p className="text-destructive text-sm">
                  {errors.fullName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-position">Position</Label>
              <Input id="emp-position" {...register("position")} />
            </div>
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select
                value={watch("employmentType")}
                onValueChange={(v) =>
                  setValue(
                    "employmentType",
                    v as CreateEmployeeInput["employmentType"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-rate">Monthly rate (PHP)</Label>
              <Input
                id="emp-rate"
                type="number"
                step="0.01"
                {...register("monthlyRate")}
              />
              {errors.monthlyRate && (
                <p className="text-destructive text-sm">
                  {errors.monthlyRate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-sss">SSS no.</Label>
              <Input id="emp-sss" {...register("sssNo")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-philhealth">PhilHealth no.</Label>
              <Input id="emp-philhealth" {...register("philhealthNo")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-pagibig">Pag-IBIG no.</Label>
              <Input id="emp-pagibig" {...register("pagibigNo")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-tin">TIN</Label>
              <Input id="emp-tin" {...register("tin")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-hire-date">Hire date</Label>
              <Input id="emp-hire-date" type="date" {...register("hireDate")} />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add employee"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
