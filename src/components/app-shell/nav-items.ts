import type { LucideIcon } from "lucide-react";
import { LayoutDashboardIcon, UsersIcon } from "lucide-react";

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
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
