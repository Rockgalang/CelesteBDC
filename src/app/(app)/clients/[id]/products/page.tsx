import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ProductsPanel } from "@/app/(app)/clients/[id]/products/products-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products & Services — Celeste.bdc" };

export default async function ClientProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: client }, { data: products }, { data: accounts }] =
    await Promise.all([
      supabase.from("clients").select("id").eq("id", id).single(),
      supabase
        .from("products_services")
        .select("*")
        .eq("client_id", id)
        .order("name"),
      supabase
        .from("chart_of_accounts")
        .select("id, code, name, type")
        .eq("client_id", id)
        .eq("active", true)
        .in("type", ["revenue", "expense"])
        .order("code"),
    ]);

  if (!client) notFound();

  return (
    <ProductsPanel
      clientId={id}
      products={products ?? []}
      revenueAccounts={(accounts ?? []).filter((a) => a.type === "revenue")}
      cogsAccounts={(accounts ?? []).filter((a) => a.type === "expense")}
    />
  );
}
