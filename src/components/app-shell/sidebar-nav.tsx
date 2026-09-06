"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

import { cn } from "@/lib/utils";
import type { NavIconKey, NavItem } from "@/components/app-shell/nav-items";

// Icon components live only here, inside the client boundary — the
// (server-rendered) NavItem data carries a string key instead of a
// component reference. See nav-items.ts for why.
const ICONS: Record<NavIconKey, LucideIcon> = {
  LayoutDashboardIcon,
  HomeIcon,
  UsersIcon,
  WorkflowIcon,
  ReceiptIcon,
  FileTextIcon,
  CameraIcon,
  ScanSearchIcon,
  LandmarkIcon,
  UsersRoundIcon,
  MailIcon,
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
