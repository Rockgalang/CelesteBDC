import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a client-workspace tab's data is loading — the layout
 * (header + tabs) stays mounted, only this content area swaps in, so tab
 * switches feel instant instead of a blank flash. */
export default function ClientWorkspaceLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
