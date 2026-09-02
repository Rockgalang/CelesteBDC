import type { Metadata } from "next";
import { MailCheckIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Verify your email — Celeste.bdc" };

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <MailCheckIcon className="text-primary mb-2 size-10" />
        <CardTitle>Check your email</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-center text-sm">
        We sent you a confirmation link. Open it to activate your account, then
        sign in.
      </CardContent>
    </Card>
  );
}
