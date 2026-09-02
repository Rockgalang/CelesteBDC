import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ReviewPanel } from "@/app/(app)/receipts/review/[id]/review-panel";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review receipt — Celeste.bdc" };

export default async function ReceiptReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("*, clients(id, business_name)")
    .eq("id", id)
    .single();

  if (!receipt) notFound();

  const client = receipt.clients as unknown as {
    id: string;
    business_name: string;
  } | null;

  const [{ data: accounts }, { data: duplicateOf }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("client_id", receipt.client_id)
      .eq("active", true)
      .order("code"),
    receipt.possible_duplicate_of
      ? supabase
          .from("receipts")
          .select("id, vendor_name")
          .eq("id", receipt.possible_duplicate_of)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {client?.business_name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Review receipt
        </h1>
      </div>

      <ReviewPanel
        receipt={receipt}
        accounts={accounts ?? []}
        duplicateOf={duplicateOf}
      />
    </div>
  );
}
