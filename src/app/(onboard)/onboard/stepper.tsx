"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/onboard", label: "Plan & business" },
  { href: "/onboard/payment", label: "Payment" },
  { href: "/onboard/business", label: "Business details" },
  { href: "/onboard/permits", label: "Permits" },
  { href: "/onboard/questionnaire", label: "Questionnaire" },
] as const;

export function OnboardStepper({ hasClient }: { hasClient: boolean }) {
  const pathname = usePathname();
  const activeIndex = STEPS.findIndex((s) => s.href === pathname);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEPS.map((step, i) => {
        // Step 1 is done the moment a client exists; steps beyond it are
        // reachable but not marked "done" here — there's no cheap signal
        // for that at this layer, and it's not worth a query per step.
        const isCurrent = i === activeIndex;
        const isReachable = i === 0 || hasClient;
        return (
          <li key={step.href} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">-</span>}
            {isReachable ? (
              <Link
                href={step.href}
                className={cn(
                  "rounded-full border px-3 py-1",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {i + 1}. {step.label}
              </Link>
            ) : (
              <span className="text-muted-foreground/50 rounded-full border px-3 py-1">
                {i + 1}. {step.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
