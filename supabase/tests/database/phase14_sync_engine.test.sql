begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select has_column('public', 'projects', 'sync_revision', 'projects has revision');
select has_column('public', 'projects', 'sync_change_seq', 'projects has change cursor');
select has_column('public', 'projects', 'last_operation_id', 'projects has idempotency key');
select has_column('public', 'projects', 'deleted_at', 'projects has tombstone');
select has_column('public', 'songs', 'sync_revision', 'songs has revision');
select has_column('public', 'songs', 'sync_change_seq', 'songs has change cursor');
select has_column('public', 'presets', 'sync_revision', 'presets has revision');
select has_column('public', 'presets', 'deleted_at', 'presets has tombstone');
select has_function('public', 'apply_sync_change', array['uuid','text','text','text','uuid','bigint','jsonb'], 'sync RPC exists');
select function_returns('public', 'apply_sync_change', array['uuid','text','text','text','uuid','bigint','jsonb'], 'jsonb', 'sync RPC returns structured json');
select is((select prosecdef from pg_proc where oid = 'public.apply_sync_change(uuid,text,text,text,uuid,bigint,jsonb)'::regprocedure), false, 'sync RPC is security invoker');
select ok((select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.apply_sync_change(uuid,text,text,text,uuid,bigint,jsonb)'::regprocedure), 'sync RPC has empty search_path');
select ok(not has_table_privilege('authenticated', 'public.projects', 'DELETE'), 'physical project delete revoked');
select ok(not has_table_privilege('authenticated', 'public.songs', 'DELETE'), 'physical song delete revoked');
select ok(not has_table_privilege('authenticated', 'public.presets', 'DELETE'), 'physical preset delete revoked');

insert into auth.users(id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('14000000-0000-4000-8000-000000000001', 'phase14-a@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('14000000-0000-4000-8000-000000000002', 'phase14-b@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000001', true);
select public.ensure_personal_workspace();

select is(
  (public.apply_sync_change(
    (select personal_workspace_id from public.profiles where id = auth.uid()), 'song', 'phase14-song', 'upsert',
    '14000000-0000-4000-8000-000000000101', null,
    '{"title":"Song A","payload":{"schemaVersion":1,"sections":[]},"entity_created_at":"2026-01-01T00:00:00Z","entity_updated_at":"2026-01-01T00:00:00Z"}'
  ) ->> 'outcome'), 'applied', 'insert applies');
select is((select sync_revision from public.songs where id = 'phase14-song'), 1::bigint, 'insert starts revision one');
select is(
  (public.apply_sync_change(
    (select personal_workspace_id from public.profiles where id = auth.uid()), 'song', 'phase14-song', 'upsert',
    '14000000-0000-4000-8000-000000000101', 99,
    '{"title":"Ignored","payload":{"schemaVersion":1,"sections":[]},"entity_created_at":"2026-01-01T00:00:00Z","entity_updated_at":"2026-01-01T00:00:00Z"}'
  ) ->> 'outcome'), 'idempotent', 'operation id is checked before revision');
select is(
  (public.apply_sync_change(
    (select personal_workspace_id from public.profiles where id = auth.uid()), 'song', 'phase14-song', 'upsert',
    '14000000-0000-4000-8000-000000000102', 99,
    '{"title":"Conflict","payload":{"schemaVersion":1,"sections":[]},"entity_created_at":"2026-01-01T00:00:00Z","entity_updated_at":"2026-01-01T00:00:00Z"}'
  ) ->> 'outcome'), 'conflict', 'wrong revision returns structured conflict');
select is(
  (public.apply_sync_change(
    (select personal_workspace_id from public.profiles where id = auth.uid()), 'song', 'phase14-song', 'delete',
    '14000000-0000-4000-8000-000000000103', 1, null
  ) ->> 'outcome'), 'applied', 'delete creates tombstone');
select ok((select deleted_at is not null and sync_revision = 2 from public.songs where id = 'phase14-song'), 'tombstone remains pullable and increments revision');
select is(
  (public.apply_sync_change(
    (select personal_workspace_id from public.profiles where id = auth.uid()), 'song', 'phase14-song', 'upsert',
    '14000000-0000-4000-8000-000000000104', 2,
    '{"title":"Restored","payload":{"schemaVersion":1,"sections":[]},"entity_created_at":"2026-01-01T00:00:00Z","entity_updated_at":"2026-01-02T00:00:00Z"}'
  ) ->> 'outcome'), 'applied', 'upsert restores tombstone');
select ok((select deleted_at is null and sync_revision = 3 and sync_change_seq > 0 from public.songs where id = 'phase14-song'), 'restore clears tombstone and advances cursor');
select throws_ok(
  $$ select public.apply_sync_change((select personal_workspace_id from public.profiles where id = auth.uid()), 'preset', 'preset-default', 'upsert', '14000000-0000-4000-8000-000000000105', null, '{}'::jsonb) $$,
  '23514', 'preset-default cannot be synchronized', 'default preset rejected');

select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000002', true);
select public.ensure_personal_workspace();
select throws_ok(
  $$ select public.apply_sync_change((select personal_workspace_id from public.profiles where id = '14000000-0000-4000-8000-000000000001'), 'song', 'foreign', 'upsert', '14000000-0000-4000-8000-000000000106', null, '{"title":"No","payload":{"schemaVersion":1,"sections":[]},"entity_created_at":"2026-01-01T00:00:00Z","entity_updated_at":"2026-01-01T00:00:00Z"}') $$,
  '42501', null, 'cross-workspace apply is blocked by RLS');

select * from finish();
rollback;
