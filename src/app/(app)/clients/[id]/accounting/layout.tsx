import { WorkspaceTabs } from "@/components/workspace/workspace-tabs";

export default async function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tabs = [
    { href: `/clients/${id}/accounting/financials`, label: "Statements" },
    { href: `/clients/${id}/accounting/bank`, label: "Banks" },
    { href: `/clients/${id}/accounting`, label: "Chart of accounts", exact: true },
  ];

  return (
    <div className="space-y-4">
      <WorkspaceTabs tabs={tabs} scope="accounting" size="sm" />
      {children}
    </div>
  );
}
