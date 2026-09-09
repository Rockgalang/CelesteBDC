import type { UserRole } from "@/lib/supabase/types";

// icon is a string key (resolved to a component inside the client-side
// SidebarNav) rather than a LucideIcon component reference — passing an
// actual component/function value from this Server Component data through
// a Server Component (the (app) layout) into a Client Component
// (SidebarNav) trips React's "Functions cannot be passed directly to
// Client Components" serialization error. A string crosses that boundary
// fine.
export type NavIconKey =
  | "LayoutDashboardIcon"
  | "HomeIcon"
  | "UsersIcon"
  | "WorkflowIcon"
  | "ReceiptIcon"
  | "FileTextIcon"
  | "CameraIcon"
  | "ScanSearchIcon"
  | "LandmarkIcon"
  | "UsersRoundIcon"
  | "MailIcon"
  | "QrCodeIcon"
  | "TableIcon"
  | "TrendingUpIcon"
  | "SlidersHorizontalIcon"
  | "FileSignatureIcon";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Ops Cockpit",
    icon: "LayoutDashboardIcon",
    roles: ["owner", "staff"],
  },
  {
    href: "/dashboard",
    label: "Home",
    icon: "HomeIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: "UsersIcon",
    roles: ["owner", "staff"],
  },
  {
    href: "/registrations",
    label: "Registrations",
    icon: "WorkflowIcon",
    roles: ["owner", "staff"],
  },
  {
    href: "/invoices",
    label: "Payments",
    icon: "ReceiptIcon",
    roles: ["owner", "staff", "client_admin"],
  },
  {
    href: "/documents",
    label: "Documents",
    icon: "FileTextIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/receipts",
    label: "Receipts",
    icon: "CameraIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "TableIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/financials",
    label: "Financials",
    icon: "TrendingUpIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/receipts/review",
    label: "Client Transactions",
    icon: "ScanSearchIcon",
    roles: ["owner", "staff"],
  },
  {
    href: "/tax",
    label: "Tax",
    icon: "LandmarkIcon",
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: "UsersRoundIcon",
    roles: ["owner", "staff"],
  },
  {
    href: "/settings/accounting-standards",
    label: "Accounting Standards",
    icon: "SlidersHorizontalIcon",
    roles: ["owner"],
  },
  {
    href: "/settings/invoice-letterhead",
    label: "Invoice letterhead",
    icon: "FileSignatureIcon",
    roles: ["owner"],
  },
  {
    href: "/settings/email-templates",
    label: "Email templates",
    icon: "MailIcon",
    roles: ["owner"],
  },
  {
    href: "/settings/payment-channels",
    label: "Payment channels",
    icon: "QrCodeIcon",
    roles: ["owner"],
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
