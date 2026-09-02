/**
 * Hand-maintained to match supabase/migrations/*.sql. Once a live project
 * is wired up, prefer regenerating this from the database with
 * `supabase gen types typescript --linked > src/lib/supabase/types.ts`
 * and keep this file as the fallback for local/offline development.
 */

export type UserRole =
  "owner" | "staff" | "client_admin" | "client_user" | "employee";

export type EntityType =
  | "sole_proprietor"
  | "opc"
  | "corporation"
  | "partnership"
  | "branch_office"
  | "rep_office";

export type TaxType = "vat" | "percentage" | "exempt";

export type ClientStatus =
  "prospect" | "onboarding" | "active" | "suspended" | "cancelled";

export type FsFrequency = "quarterly" | "monthly";

export type DocumentSource = "portal" | "internal" | "generated";

export type JobType =
  | "dti"
  | "sec"
  | "lgu_barangay"
  | "lgu_mayors_permit"
  | "lgu_zoning"
  | "lgu_sanitary"
  | "lgu_fire"
  | "bir_registration"
  | "bir_atp"
  | "bir_books"
  | "sec_gis";

export type JobStatus =
  "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
export type StageStatus = "pending" | "in_progress" | "completed" | "skipped";

export type SubscriptionCycle = "monthly" | "annual";
export type SubscriptionStatus = "active" | "grace" | "suspended" | "cancelled";
export type InvoiceStatus =
  "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void";
export type InvoiceLineKind =
  | "subscription"
  | "txn_overage"
  | "employee_overage"
  | "govt_fee"
  | "handling_fee"
  | "one_time"
  | "adjustment";
export type PaymentMethod = "gcash" | "bank_transfer" | "cash" | "other";
export type PaymentStatus = "submitted" | "confirmed" | "rejected";

export type NotificationChannel = "email" | "sms";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type ClientsRow = {
  id: string;
  business_name: string;
  trade_name: string | null;
  entity_type: EntityType;
  tin: string | null;
  rdo_code: string | null;
  tax_type: TaxType;
  fiscal_year_end_month: number;
  vat_registered: boolean;
  dti_reg_no: string | null;
  sec_reg_no: string | null;
  mayors_permit_no: string | null;
  address_line: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  status: ClientStatus;
  onboarded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ClientContactsRow = {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type ProfilesRow = {
  id: string;
  role: UserRole;
  client_id: string | null;
  full_name: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type PlansRow = {
  id: string;
  code: string;
  name: string;
  price_monthly: string;
  price_annual_monthly: string;
  txn_limit: number | null;
  employee_limit: number | null;
  sla_days: number;
  fs_frequency: FsFrequency;
  features: Record<string, unknown>;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type BillingConfigRow = {
  id: string;
  key: string;
  amount: string;
  unit: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type DocumentsRow = {
  id: string;
  client_id: string | null;
  category: string;
  filename: string;
  storage_path: string;
  mime: string;
  bytes: number;
  sha256: string;
  uploaded_by: string | null;
  source: DocumentSource;
  issued_date: string | null;
  expires_at: string | null;
  retention_until: string;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type JobStageTemplatesRow = {
  id: string;
  job_type: JobType;
  name: string;
  sequence: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type JobChecklistTemplatesRow = {
  id: string;
  job_type: JobType;
  label: string;
  required: boolean;
  sequence: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type RegistrationJobsRow = {
  id: string;
  client_id: string;
  job_type: JobType;
  is_renewal: boolean;
  status: JobStatus;
  current_stage: string | null;
  target_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type JobStagesRow = {
  id: string;
  job_id: string;
  name: string;
  sequence: number;
  status: StageStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type JobChecklistItemsRow = {
  id: string;
  job_id: string;
  label: string;
  required: boolean;
  satisfied_by_document_id: string | null;
  satisfied_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type GovernmentFeesRow = {
  id: string;
  job_id: string;
  agency: string;
  description: string;
  amount_at_cost: string;
  handling_fee: string;
  receipt_document_id: string | null;
  billed_invoice_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type SubscriptionsRow = {
  id: string;
  client_id: string;
  plan_id: string;
  cycle: SubscriptionCycle;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  price_locked_until: string | null;
  locked_price: string | null;
  status: SubscriptionStatus;
  cancel_notice_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type InvoicesRow = {
  id: string;
  client_id: string;
  subscription_id: string | null;
  number: string | null;
  issue_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  subtotal: string;
  total: string;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type InvoiceLinesRow = {
  id: string;
  invoice_id: string;
  kind: InvoiceLineKind;
  description: string;
  qty: string;
  unit_price: string;
  amount: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type PaymentsRow = {
  id: string;
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string | null;
  proof_document_id: string | null;
  status: PaymentStatus;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type EngagementLettersRow = {
  id: string;
  client_id: string;
  document_id: string | null;
  template_version: string;
  signed_by_name: string;
  signed_by_profile_id: string | null;
  ip: string | null;
  user_agent: string | null;
  signed_at: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type NotificationDeliveryStatus = "pending" | "sent" | "failed";

export type NotificationsRow = {
  id: string;
  recipient_profile_id: string;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  delivery_status: NotificationDeliveryStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type EmailTemplatesRow = {
  key: string;
  subject: string;
  body_text: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type TasksRow = {
  id: string;
  client_id: string | null;
  title: string;
  kind: string;
  due_at: string | null;
  priority: TaskPriority;
  assigned_to: string | null;
  status: TaskStatus;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type AuditLogRow = {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// Insert types: only genuinely required columns (NOT NULL, no default) are
// mandatory — every nullable or has-a-default column is optional, matching
// what `supabase gen types typescript` would produce and what postgrest-js
// actually accepts.
type ClientsInsert = Pick<
  ClientsRow,
  "business_name" | "entity_type" | "tax_type"
> &
  Partial<Omit<ClientsRow, "business_name" | "entity_type" | "tax_type">>;
type ClientContactsInsert = Pick<ClientContactsRow, "client_id" | "name"> &
  Partial<Omit<ClientContactsRow, "client_id" | "name">>;
type ProfilesInsert = Pick<ProfilesRow, "id"> &
  Partial<Omit<ProfilesRow, "id">>;
type PlansInsert = Pick<
  PlansRow,
  | "code"
  | "name"
  | "price_monthly"
  | "price_annual_monthly"
  | "sla_days"
  | "fs_frequency"
  | "sort_order"
> &
  Partial<
    Omit<
      PlansRow,
      | "code"
      | "name"
      | "price_monthly"
      | "price_annual_monthly"
      | "sla_days"
      | "fs_frequency"
      | "sort_order"
    >
  >;
type BillingConfigInsert = Pick<BillingConfigRow, "key" | "amount" | "unit"> &
  Partial<Omit<BillingConfigRow, "key" | "amount" | "unit">>;
type DocumentsInsert = Pick<
  DocumentsRow,
  "category" | "filename" | "storage_path" | "mime" | "bytes" | "sha256"
> &
  Partial<
    Omit<
      DocumentsRow,
      "category" | "filename" | "storage_path" | "mime" | "bytes" | "sha256"
    >
  >;
type JobStageTemplatesInsert = Pick<
  JobStageTemplatesRow,
  "job_type" | "name" | "sequence"
> &
  Partial<Omit<JobStageTemplatesRow, "job_type" | "name" | "sequence">>;
type JobChecklistTemplatesInsert = Pick<
  JobChecklistTemplatesRow,
  "job_type" | "label" | "sequence"
> &
  Partial<Omit<JobChecklistTemplatesRow, "job_type" | "label" | "sequence">>;
type RegistrationJobsInsert = Pick<
  RegistrationJobsRow,
  "client_id" | "job_type"
> &
  Partial<Omit<RegistrationJobsRow, "client_id" | "job_type">>;
type JobStagesInsert = Pick<JobStagesRow, "job_id" | "name" | "sequence"> &
  Partial<Omit<JobStagesRow, "job_id" | "name" | "sequence">>;
type JobChecklistItemsInsert = Pick<JobChecklistItemsRow, "job_id" | "label"> &
  Partial<Omit<JobChecklistItemsRow, "job_id" | "label">>;
type GovernmentFeesInsert = Pick<
  GovernmentFeesRow,
  "job_id" | "agency" | "description" | "amount_at_cost" | "handling_fee"
> &
  Partial<
    Omit<
      GovernmentFeesRow,
      "job_id" | "agency" | "description" | "amount_at_cost" | "handling_fee"
    >
  >;
type SubscriptionsInsert = Pick<
  SubscriptionsRow,
  "client_id" | "plan_id" | "cycle" | "current_period_end"
> &
  Partial<
    Omit<
      SubscriptionsRow,
      "client_id" | "plan_id" | "cycle" | "current_period_end"
    >
  >;
type InvoicesInsert = Pick<InvoicesRow, "client_id" | "due_date"> &
  Partial<Omit<InvoicesRow, "client_id" | "due_date">>;
type InvoiceLinesInsert = Pick<
  InvoiceLinesRow,
  "invoice_id" | "kind" | "description" | "unit_price"
> &
  Partial<
    Omit<
      InvoiceLinesRow,
      "invoice_id" | "kind" | "description" | "unit_price" | "amount"
    >
  >;
type PaymentsInsert = Pick<PaymentsRow, "invoice_id" | "amount" | "method"> &
  Partial<Omit<PaymentsRow, "invoice_id" | "amount" | "method">>;
type EngagementLettersInsert = Pick<
  EngagementLettersRow,
  "client_id" | "signed_by_name"
> &
  Partial<Omit<EngagementLettersRow, "client_id" | "signed_by_name">>;
type NotificationsInsert = Pick<
  NotificationsRow,
  "recipient_profile_id" | "template"
> &
  Partial<Omit<NotificationsRow, "recipient_profile_id" | "template">>;
type TasksInsert = Pick<TasksRow, "title"> & Partial<Omit<TasksRow, "title">>;
type EmailTemplatesInsert = Pick<
  EmailTemplatesRow,
  "key" | "subject" | "body_text"
> &
  Partial<Omit<EmailTemplatesRow, "key" | "subject" | "body_text">>;

export type Database = {
  public: {
    Tables: {
      clients: TableDef<
        ClientsRow,
        ClientsInsert,
        Partial<Omit<ClientsRow, "id">>
      >;
      client_contacts: TableDef<
        ClientContactsRow,
        ClientContactsInsert,
        Partial<Omit<ClientContactsRow, "id">>
      >;
      profiles: TableDef<
        ProfilesRow,
        ProfilesInsert,
        Partial<Omit<ProfilesRow, "id">>
      >;
      plans: TableDef<PlansRow, PlansInsert, Partial<Omit<PlansRow, "id">>>;
      billing_config: TableDef<
        BillingConfigRow,
        BillingConfigInsert,
        Partial<Omit<BillingConfigRow, "id">>
      >;
      documents: TableDef<
        DocumentsRow,
        DocumentsInsert,
        Partial<Omit<DocumentsRow, "id">>
      >;
      job_stage_templates: TableDef<
        JobStageTemplatesRow,
        JobStageTemplatesInsert,
        Partial<Omit<JobStageTemplatesRow, "id">>
      >;
      job_checklist_templates: TableDef<
        JobChecklistTemplatesRow,
        JobChecklistTemplatesInsert,
        Partial<Omit<JobChecklistTemplatesRow, "id">>
      >;
      registration_jobs: TableDef<
        RegistrationJobsRow,
        RegistrationJobsInsert,
        Partial<Omit<RegistrationJobsRow, "id">>
      >;
      job_stages: TableDef<
        JobStagesRow,
        JobStagesInsert,
        Partial<Omit<JobStagesRow, "id">>
      >;
      job_checklist_items: TableDef<
        JobChecklistItemsRow,
        JobChecklistItemsInsert,
        Partial<Omit<JobChecklistItemsRow, "id">>
      >;
      government_fees: TableDef<
        GovernmentFeesRow,
        GovernmentFeesInsert,
        Partial<Omit<GovernmentFeesRow, "id">>
      >;
      subscriptions: TableDef<
        SubscriptionsRow,
        SubscriptionsInsert,
        Partial<Omit<SubscriptionsRow, "id">>
      >;
      invoices: TableDef<
        InvoicesRow,
        InvoicesInsert,
        Partial<Omit<InvoicesRow, "id">>
      >;
      invoice_lines: TableDef<
        InvoiceLinesRow,
        InvoiceLinesInsert,
        Partial<Omit<InvoiceLinesRow, "id" | "amount">>
      >;
      payments: TableDef<
        PaymentsRow,
        PaymentsInsert,
        Partial<Omit<PaymentsRow, "id">>
      >;
      engagement_letters: TableDef<
        EngagementLettersRow,
        EngagementLettersInsert,
        Partial<Omit<EngagementLettersRow, "id">>
      >;
      notifications: TableDef<
        NotificationsRow,
        NotificationsInsert,
        Partial<Omit<NotificationsRow, "id">>
      >;
      tasks: TableDef<TasksRow, TasksInsert, Partial<Omit<TasksRow, "id">>>;
      email_templates: TableDef<
        EmailTemplatesRow,
        EmailTemplatesInsert,
        Partial<Omit<EmailTemplatesRow, "key">>
      >;
      audit_log: TableDef<AuditLogRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_first_owner: {
        Args: Record<string, never>;
        Returns: ProfilesRow;
      };
      owner_exists: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_registration_job: {
        Args: {
          p_client_id: string;
          p_job_type: JobType;
          p_is_renewal?: boolean;
          p_target_date?: string | null;
          p_notes?: string | null;
        };
        Returns: RegistrationJobsRow;
      };
      advance_registration_job_stage: {
        Args: { p_job_id: string };
        Returns: RegistrationJobsRow;
      };
      confirm_payment: {
        Args: { p_payment_id: string };
        Returns: PaymentsRow;
      };
      reject_payment: {
        Args: { p_payment_id: string };
        Returns: PaymentsRow;
      };
    };
    Enums: {
      user_role: UserRole;
      entity_type: EntityType;
      tax_type: TaxType;
      client_status: ClientStatus;
      fs_frequency: FsFrequency;
      document_source: DocumentSource;
      job_type: JobType;
      job_status: JobStatus;
      stage_status: StageStatus;
      subscription_cycle: SubscriptionCycle;
      subscription_status: SubscriptionStatus;
      invoice_status: InvoiceStatus;
      invoice_line_kind: InvoiceLineKind;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      notification_channel: NotificationChannel;
      task_status: TaskStatus;
      task_priority: TaskPriority;
    };
  };
};
