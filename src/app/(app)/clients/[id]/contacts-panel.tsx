"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createContactAction } from "@/app/(app)/clients/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  clientContactSchema,
  type ClientContactInput,
} from "@/lib/validation/clients";
import type { ClientContactsRow } from "@/lib/supabase/types";

export function ContactsPanel({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ClientContactsRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientContactInput>({
    resolver: zodResolver(clientContactSchema),
    defaultValues: { clientId, isPrimary: contacts.length === 0 },
  });

  const onSubmit = (data: ClientContactInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createContactAction(data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      reset({
        clientId,
        name: "",
        role: "",
        email: "",
        phone: "",
        isPrimary: false,
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.length > 0 ? (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.role && (
                    <span className="text-muted-foreground"> · {c.role}</span>
                  )}
                  <div className="text-muted-foreground text-xs">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                {c.is_primary && <Badge variant="secondary">Primary</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No contacts yet.</p>
        )}

        <Separator />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" {...register("name")} />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-role">Role</Label>
              <Input id="contact-role" {...register("role")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" {...register("phone")} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="contact-primary"
              checked={watch("isPrimary")}
              onCheckedChange={(v) => setValue("isPrimary", v === true)}
            />
            <Label htmlFor="contact-primary">Primary contact</Label>
          </div>
          {formError && <p className="text-destructive text-sm">{formError}</p>}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Adding..." : "Add contact"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
