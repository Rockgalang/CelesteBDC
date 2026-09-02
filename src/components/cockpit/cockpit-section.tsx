import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CockpitSection({
  title,
  icon: Icon,
  count,
  urgent,
  href,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  urgent?: boolean;
  href?: string;
  emptyLabel: string;
  children?: React.ReactNode;
}) {
  const content = (
    <Card
      className={cn(
        "h-full gap-3 py-4 transition-colors",
        href && "hover:border-primary/50",
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            {title}
          </span>
          <Badge variant={urgent && count > 0 ? "destructive" : "secondary"}>
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {count === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
