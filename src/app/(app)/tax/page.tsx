import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { formatManila } from "@/lib/format";
import { isOverdue, upcomingTaxObligations } from "@/lib/tax/deadlines";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tax calendar — Celeste.bdc" };

export default async function PortalTaxPage() {
  const profile = await getCurrentProfile();

  if (!profile.client_id) {
    return (
      <p className="text-muted-foreground text-sm">
        Your account isn&apos;t linked to a client yet. Contact your Celeste
        BDC representative.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_name, entity_type, tax_type, vat_registered")
    .eq("id", profile.client_id)
    .single();

  const obligations = client
    ? upcomingTaxObligations({
        taxType: client.tax_type,
        vatRegistered: client.vat_registered,
        entityType: client.entity_type,
      })
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tax calendar
        </h1>
        <p className="text-muted-foreground text-sm">
          What&apos;s due for {client?.business_name ?? "your business"}, and
          when. This is a planning aid, not tax advice — Cel&apos;s team
          reviews and prepares filings; nothing here files anything on your
          behalf automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming filings</CardTitle>
        </CardHeader>
        <CardContent>
          {obligations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing due in the next six months.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((o) => (
                  <TableRow key={`${o.formNumber}-${o.dueDate}`}>
                    <TableCell className="font-mono">
                      {o.formNumber}
                    </TableCell>
                    <TableCell>{o.description}</TableCell>
                    <TableCell>{formatManila(o.dueDate)}</TableCell>
                    <TableCell>
                      {isOverdue(o.dueDate) ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
