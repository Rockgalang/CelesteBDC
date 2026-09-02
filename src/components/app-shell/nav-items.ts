import type { LucideIcon } from "lucide-react";
import {
  FileTextIcon,
  LayoutDashboardIcon,
  MailIcon,
  ReceiptIcon,
  UsersIcon,
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
    href: "/",
    label: "Ops Cockpit",
    icon: LayoutDashboardIcon,
    roles: ["owner", "staff"],
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
    href: "/settings/email-templates",
    label: "Email templates",
    icon: MailIcon,
    roles: ["owner"],
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
