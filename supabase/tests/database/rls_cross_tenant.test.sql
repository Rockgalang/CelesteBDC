-- RLS cross-tenant test (build spec §4: "a client_admin from Client A
-- attempting to read Client B's receipts must fail at the database level
-- even with a forged application-layer request").
--
-- Run with the Supabase CLI against a local stack:
--   supabase start
--   supabase test db
--
-- Requires the pgTAP extension, which `supabase test db` enables
-- automatically in its ephemeral test database.

begin;
select plan(8);

-- ---------------------------------------------------------------------
-- Fixtures: two clients, one document each, one client_admin per client.
-- ---------------------------------------------------------------------
insert into public.clients (id, business_name, entity_type, tax_type)
values
  ('11111111-1111-1111-1111-111111111111', 'Client A Corp', 'sole_proprietor', 'percentage'),
  ('22222222-2222-2222-2222-222222222222', 'Client B Corp', 'sole_proprietor', 'percentage');

-- auth.users rows so profiles.id / created_by FKs resolve, and so
-- auth.uid() (which reads the JWT sub we set below) matches a real user.
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-a@example.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@example.test');

update public.profiles
  set role = 'client_admin', client_id = '11111111-1111-1111-1111-111111111111'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.profiles
  set role = 'client_admin', client_id = '22222222-2222-2222-2222-222222222222'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

insert into public.documents (
  id, client_id, category, filename, storage_path, mime, bytes, sha256
) values
  ('c0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
    'receipt', 'a.jpg', '11111111-1111-1111-1111-111111111111/a.jpg', 'image/jpeg', 100, repeat('a', 64)),
  ('c0000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222',
    'receipt', 'b.jpg', '22222222-2222-2222-2222-222222222222/b.jpg', 'image/jpeg', 100, repeat('b', 64));

-- ---------------------------------------------------------------------
-- Act as Client A's client_admin.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text,
  true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

select is(
  (select count(*) from public.clients where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'client_admin A can read their own client row'
);

select is(
  (select count(*) from public.clients where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'client_admin A cannot read Client B''s client row'
);

select is(
  (select count(*) from public.documents where client_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'client_admin A can read their own document'
);

select is(
  (select count(*) from public.documents where client_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'client_admin A cannot read Client B''s document, even by direct id/client_id lookup'
);

-- RLS silently filters out the target row rather than raising, so a
-- forged update to Client B's row just affects 0 rows — verify that via a
-- follow-up read rather than expecting an exception.
update public.clients set business_name = 'Hijacked' where id = '22222222-2222-2222-2222-222222222222';

select is(
  (select business_name from public.clients where id = '22222222-2222-2222-2222-222222222222'),
  null::text,
  'the forged update above did not change Client B (row invisible, so 0 rows matched)'
);

-- A client_admin cannot self-promote to owner or reassign their client_id.
select throws_ok(
  $$ update public.profiles set role = 'owner' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'P0001',
  'Only owner can change role, client_id, or active on a profile.',
  'client_admin A cannot self-promote to owner'
);

-- ---------------------------------------------------------------------
-- Act as Client B's client_admin to confirm the isolation is symmetric.
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text,
  true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);

select is(
  (select count(*) from public.clients where id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'client_admin B cannot read Client A''s client row'
);

select is(
  (select count(*) from public.documents where client_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'client_admin B cannot read Client A''s document'
);

select * from finish();
rollback;
