"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export type WorkspaceTab = { href: string; label: string; exact?: boolean };

/** Animated tab bar: the active tab gets a sliding pill background shared
 * across tabs via a stable layoutId, so switching tabs animates the pill
 * instead of just swapping styles. `scope` namespaces the layoutId so two
 * of these on one page (e.g. the client-level tabs and Accounting's own
 * sub-tabs) don't animate into each other. */
export function WorkspaceTabs({
  tabs,
  scope,
  size = "default",
}: {
  tabs: WorkspaceTab[];
  scope: string;
  size?: "default" | "sm";
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-wrap gap-1 border-b",
        size === "sm" ? "text-sm" : "",
      )}
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative -mb-px px-3 font-medium transition-colors",
              size === "sm" ? "py-2" : "py-2.5",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {active && (
              <motion.div
                layoutId={`${scope}-active-tab`}
                className="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
