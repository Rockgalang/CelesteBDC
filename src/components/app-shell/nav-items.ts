import type { LucideIcon } from "lucide-react";
import {
  CameraIcon,
  FileTextIcon,
  HomeIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MailIcon,
  ReceiptIcon,
  ScanSearchIcon,
  UsersIcon,
  UsersRoundIcon,
  WorkflowIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/supabase/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Ops Cockpit",
    icon: LayoutDashboardIcon,
    roles: ["owner", "staff"],
  },
  {
    href: "/dashboard",
    label: "Home",
    icon: HomeIcon,
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: UsersIcon,
    roles: ["owner", "staff"],
  },
  {
    href: "/registrations",
    label: "Registrations",
    icon: WorkflowIcon,
    roles: ["owner", "staff"],
  },
  {
    href: "/invoices",
    label: "Invoices",
    icon: ReceiptIcon,
    roles: ["owner", "staff", "client_admin"],
  },
  {
    href: "/documents",
    label: "Documents",
    icon: FileTextIcon,
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/receipts",
    label: "Receipts",
    icon: CameraIcon,
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/receipts/review",
    label: "Receipt review",
    icon: ScanSearchIcon,
    roles: ["owner", "staff"],
  },
  {
    href: "/tax",
    label: "Tax",
    icon: LandmarkIcon,
    roles: ["client_admin", "client_user"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: UsersRoundIcon,
    roles: ["owner", "staff"],
  },
  {
    href: "/settings/email-templates",
    label: "Email templates",
    icon: MailIcon,
    roles: ["owner"],
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
