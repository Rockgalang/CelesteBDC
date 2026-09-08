import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/current-profile";
import { CLIENT_STATUS_VARIANT } from "@/lib/client-status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clients — Celeste.bdc" };

export default async function ClientsPage() {
  await requireRole("owner", "staff");

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name, trade_name, entity_type, status, city")
    .order("business_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm">
            {clients?.length ?? 0} client{clients?.length === 1 ? "" : "s"} on
            file.
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <PlusIcon />
            New client
          </Link>
        </Button>
      </div>

      {clients && clients.length > 0 ? (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business name</TableHead>
                <TableHead>Entity type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow
                  key={c.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="block hover:underline">
                      <div className="font-medium">{c.business_name}</div>
                      {c.trade_name && (
                        <div className="text-muted-foreground text-xs">
                          {c.trade_name}
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">
                    {c.entity_type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={CLIENT_STATUS_VARIANT[c.status] ?? "secondary"}
                      className="capitalize"
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No clients yet. Add your first one to get started.
        </div>
      )}
    </div>
  );
}
