import type { ClientStatus } from "@/lib/supabase/types";

export const CLIENT_STATUS_VARIANT: Record<
  ClientStatus,
  "secondary" | "success" | "warning" | "destructive"
> = {
  prospect: "secondary",
  onboarding: "warning",
  active: "success",
  suspended: "warning",
  cancelled: "destructive",
};
