import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/supabase/types";

const STATUS_VARIANT: Record<
  JobStatus,
  "secondary" | "success" | "warning" | "destructive"
> = {
  not_started: "secondary",
  in_progress: "warning",
  blocked: "destructive",
  completed: "success",
  cancelled: "secondary",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
