import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, UserCogIcon } from "lucide-react";

import { PageTransition } from "@/components/workspace/page-transition";
import { WorkspaceTabs } from "@/components/workspace/workspace-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLIENT_STATUS_VARIANT } from "@/lib/client-status";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ClientWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner", "staff");
  const { id } = await params;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, trade_name, status")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const tabs = [
    { href: `/clients/${id}`, label: "Dashboard", exact: true },
    { href: `/clients/${id}/files`, label: "Client's Files" },
    { href: `/clients/${id}/books`, label: "Books" },
    { href: `/clients/${id}/accounting`, label: "Accounting" },
    { href: `/clients/${id}/products`, label: "Products & Services" },
    { href: `/clients/${id}/tax`, label: "Tax" },
    { href: `/clients/${id}/payroll`, label: "Payroll" },
    { href: `/clients/${id}/invoices`, label: "Subscription & Billing" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="space-y-3">
        <Link
          href="/clients"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Clients
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.business_name}
            </h1>
            <Badge
              variant={CLIENT_STATUS_VARIANT[client.status]}
              className="capitalize"
            >
              {client.status}
            </Badge>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${id}/profile`}>
              <UserCogIcon className="size-4" />
              Update client profile
            </Link>
          </Button>
        </div>
        {client.trade_name && (
          <p className="text-muted-foreground -mt-2 text-sm">{client.trade_name}</p>
        )}
      </div>

      <WorkspaceTabs tabs={tabs} scope="client" />

      <PageTransition>{children}</PageTransition>
    </div>
  );
}
