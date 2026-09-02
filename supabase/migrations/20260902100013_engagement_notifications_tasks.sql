-- Engagement letter signature capture (build spec §7.2, open item #4:
-- "the portal needs a signable engagement letter at onboarding. Legal
-- copy to be supplied; build the flow with a placeholder document and a
-- signature-capture step."). This records the acceptance event; the
-- rendered PDF itself is a normal `documents` row (category
-- 'engagement_letter', already in the Phase 0 category list) that this
-- table points at.
--
-- Also: notifications and tasks (build spec §6.8).

create table public.engagement_letters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  -- Bumped whenever the placeholder/real legal copy changes, so an old
  -- signature can be told apart from a signature against the current text.
  template_version text not null default 'placeholder-v1',
  signed_by_name text not null,
  signed_by_profile_id uuid references public.profiles (id),
  ip text,
  user_agent text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.engagement_letters
  for each row execute function public.set_updated_at();

create index engagement_letters_client_id_idx on public.engagement_letters (client_id);

create trigger audit_engagement_letters
  after insert or update or delete on public.engagement_letters
  for each row execute function public.audit_row_change();

alter table public.engagement_letters enable row level security;

create policy engagement_letters_internal_all on public.engagement_letters
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy engagement_letters_select_own_client on public.engagement_letters
  for select using (client_id = public.current_profile_client_id());
-- client_admin signs their own client's letter during onboarding.
create policy engagement_letters_insert_own_client_admin on public.engagement_letters
  for insert
  with check (
    client_id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  );

-- ---------------------------------------------------------------------
create type public.notification_channel as enum ('email', 'sms');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null default 'email',
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

create index notifications_recipient_idx on public.notifications (recipient_profile_id);
create index notifications_unsent_idx on public.notifications (scheduled_for) where sent_at is null;

alter table public.notifications enable row level security;

create policy notifications_internal_all on public.notifications
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy notifications_select_own on public.notifications
  for select using (recipient_profile_id = auth.uid());
create policy notifications_mark_read_own on public.notifications
  for update using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- ---------------------------------------------------------------------
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  title text not null,
  kind text not null default 'general',
  due_at timestamptz,
  priority public.task_priority not null default 'normal',
  assigned_to uuid references public.profiles (id),
  status public.task_status not null default 'open',
  -- Loosely typed pointer at whatever triggered the task (e.g.
  -- source_type = 'registration_job', source_id = that job's id) so later
  -- phases can create tasks without a schema change here.
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_client_id_idx on public.tasks (client_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_idx on public.tasks (status);

alter table public.tasks enable row level security;

create policy tasks_internal_all on public.tasks
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
