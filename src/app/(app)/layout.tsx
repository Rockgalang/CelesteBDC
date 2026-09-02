import Link from "next/link";

import { navItemsForRole } from "@/components/app-shell/nav-items";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const items = navItemsForRole(profile.role);

  return (
    <div className="flex min-h-screen">
      <aside className="bg-card hidden w-60 shrink-0 flex-col border-r p-4 md:flex">
        <Link
          href="/dashboard"
          className="mb-6 px-3 text-lg font-semibold tracking-tight"
        >
          Celeste<span className="text-primary">.bdc</span>
        </Link>
        <SidebarNav items={items} />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="bg-card flex h-14 items-center justify-between border-b px-4 md:px-6">
          <span className="text-muted-foreground text-sm font-medium md:hidden">
            Celeste.bdc
          </span>
          <div className="ml-auto">
            <UserMenu
              fullName={profile.full_name}
              email={profile.email}
              role={profile.role}
            />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
