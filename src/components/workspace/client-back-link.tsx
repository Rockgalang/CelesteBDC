import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

/** Consistent "back to this client's workspace" shortcut for pages that
 * reference a single client but live outside /clients/[id]/** (invoice,
 * registration job, and receipt-review detail pages) — those don't
 * inherit the client-workspace tab bar, so without this there's no way
 * back to the client's dashboard except the browser back button. */
export function ClientBackLink({
  clientId,
  businessName,
}: {
  clientId: string;
  businessName: string;
}) {
  return (
    <Link
      href={`/clients/${clientId}`}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
    >
      <ArrowLeftIcon className="size-3.5" />
      {businessName}
    </Link>
  );
}
