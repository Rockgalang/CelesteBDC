import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpenCheckIcon,
  CameraIcon,
  FileTextIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
  WorkflowIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Celeste.bdc — Philippine business compliance, handled",
};

const FEATURES = [
  {
    icon: WorkflowIcon,
    title: "Registration & licensing",
    description:
      "DTI, SEC, LGU, and BIR registration tracked stage by stage, with a checklist and government fee ledger for every step.",
  },
  {
    icon: BookOpenCheckIcon,
    title: "Bookkeeping",
    description:
      "Snap a photo of a receipt and we extract the details automatically. Cel's team reviews and posts every transaction to a proper double-entry ledger.",
  },
  {
    icon: LandmarkIcon,
    title: "Tax filing support",
    description:
      "A running calendar of what's due and when, with your filing history kept on file. We don't file for you through an API — a human always reviews before anything is submitted.",
  },
  {
    icon: UsersRoundIcon,
    title: "Payroll",
    description:
      "Employee payroll and government contributions, on plans that include it. Locked on the Start Up plan to keep pricing lean for solo founders.",
  },
  {
    icon: FileTextIcon,
    title: "Document vault",
    description:
      "Every certificate, permit, and receipt in one private, retained-per-BIR-rules archive — never a public link.",
  },
  {
    icon: CameraIcon,
    title: "Client portal",
    description:
      "See registration status, outstanding invoices, and your documents any time, from your phone.",
  },
];

async function getLoggedInUser() {
  // This page must render even with no Supabase project wired up yet
  // (e.g. a fresh Vercel deploy before env vars are set) — never let a
  // missing/invalid URL crash the one page every visitor hits first.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

async function getActivePlans() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  try {
    const admin = createAdminClient();
    const { data: plans } = await admin
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    return plans;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const [user, plans] = await Promise.all([
    getLoggedInUser(),
    getActivePlans(),
  ]);

  return (
    <div className="bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">
          Celeste<span className="text-primary">.bdc</span>
        </span>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <Badge variant="secondary" className="mb-4">
          Built for Philippine sole proprietors, corporations, and startups
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Business registration, bookkeeping, and compliance —
          <span className="text-primary"> handled by a real team</span>.
        </h1>
        <p className="text-muted-foreground mt-6 text-lg">
          Celeste BDC registers your business with DTI, SEC, LGU, and BIR,
          keeps your books, and tracks every filing deadline — so you can
          focus on running the business, not chasing paperwork.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <f.icon className="text-primary size-5" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {plans && plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" id="pricing">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
            <p className="text-muted-foreground text-sm">
              Flat monthly pricing, no surprise fees. Annual billing locks in
              a lower rate.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-2xl font-semibold">
                      {formatPeso(money(plan.price_monthly))}
                    </span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatPeso(money(plan.price_annual_monthly))}/mo billed
                    annually
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>
                      {plan.txn_limit
                        ? `${plan.txn_limit} bookkeeping transactions / mo`
                        : "Unlimited transactions"}
                    </li>
                    <li>
                      {plan.employee_limit
                        ? `Payroll for up to ${plan.employee_limit} employees`
                        : "Payroll not included"}
                    </li>
                    <li className="capitalize">
                      {plan.fs_frequency} financial statements
                    </li>
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          <ShieldCheckIcon className="size-4" />
          <span>
            Celeste BDC is a business-compliance service, not an accounting
            or law firm. Bookkeeping and filing support are prepared for your
            review, not a substitute for independent CPA or legal advice.
          </span>
        </div>
      </section>

      <footer className="text-muted-foreground border-t px-4 py-8 text-center text-xs sm:px-6">
        © {new Date().getFullYear()} Celeste BDC.
      </footer>
    </div>
  );
}
