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
    };
    Enums: {
      user_role: UserRole;
      entity_type: EntityType;
      tax_type: TaxType;
      client_status: ClientStatus;
      fs_frequency: FsFrequency;
      document_source: DocumentSource;
    };
  };
};
