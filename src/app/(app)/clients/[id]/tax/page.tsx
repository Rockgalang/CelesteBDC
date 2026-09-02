import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { TaxPanel } from "@/app/(app)/clients/[id]/tax/tax-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-profile";
import { upcomingTaxObligations } from "@/lib/tax/deadlines";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tax calendar — Celeste.bdc" };

export default async function ClientTaxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: filedTasks }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, business_name, entity_type, tax_type, vat_registered")
      .eq("id", id)
      .single(),
    supabase
      .from("tasks")
      .select("kind")
      .eq("client_id", id)
      .eq("status", "done")
      .like("kind", "tax_filing:%"),
  ]);

  if (!client) notFound();

  const obligations = upcomingTaxObligations({
    taxType: client.tax_type,
    vatRegistered: client.vat_registered,
    entityType: client.entity_type,
  });
  const filedKinds = new Set((filedTasks ?? []).map((t) => t.kind));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tax calendar — {client.business_name}
        </h1>
        <p className="text-muted-foreground text-sm">
          What&apos;s due, and when. A planning aid, not tax advice — verify
          every deadline independently.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming and recent filings</CardTitle>
        </CardHeader>
        <CardContent>
          {obligations.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing due in the next six months.
            </p>
          ) : (
            <TaxPanel
              clientId={id}
              obligations={obligations}
              filedKinds={filedKinds}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
