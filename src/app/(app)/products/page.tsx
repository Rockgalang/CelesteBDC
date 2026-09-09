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
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products & Services — Celeste.bdc" };

export default async function ClientProductsPage() {
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
  const { data: products } = await supabase
    .from("products_services")
    .select("*")
    .eq("client_id", profile.client_id)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Products & services
        </h1>
        <p className="text-muted-foreground text-sm">
          Your catalog as set up by Cel&apos;s team — used when tracking
          inventory and posting sales to your books. Contact Cel to add or
          change an item.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Qty on hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.name}
                        {!p.active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      {p.description && (
                        <p className="text-muted-foreground text-xs">
                          {p.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{p.kind}</TableCell>
                    <TableCell>{formatPeso(money(p.unit_price))}</TableCell>
                    <TableCell>
                      {p.track_inventory ? p.quantity_on_hand : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No products or services set up yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
