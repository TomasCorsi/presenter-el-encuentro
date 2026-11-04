begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-000000000001', 'owner@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'operator@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'outsider@example.test', crypt('password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok($$ select public.ensure_personal_workspace() $$, 'authenticated user bootstraps workspace');
select lives_ok($$ select public.ensure_personal_workspace() $$, 'workspace bootstrap is idempotent');
select is((select count(*)::int from public.profiles where id = auth.uid()), 1, 'one profile');
select is((select count(*)::int from public.workspace_members where user_id = auth.uid() and role = 'owner'), 1, 'one owner membership');

reset role;
insert into public.workspace_members(workspace_id, user_id, role)
select personal_workspace_id, '00000000-0000-4000-8000-000000000002', 'operator'
from public.profiles where id = '00000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
insert into public.projects(workspace_id, id, name, payload, entity_created_at, entity_updated_at)
select personal_workspace_id, 'project-1', 'Project', '{"schemaVersion":1,"rundown":[]}', now(), now()
from public.profiles where id = auth.uid();
select is((select count(*)::int from public.projects), 1, 'owner writes and reads own workspace');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::int from public.projects), 1, 'operator reads same workspace');
select lives_ok($$ update public.projects set name = 'Updated' where id = 'project-1' $$, 'operator writes content');
select is_empty($$ update public.workspaces set name = 'Forbidden' returning id $$,
  'operator cannot administer workspace');
select throws_ok($$ insert into public.workspace_members(workspace_id, user_id, role) select workspace_id, '00000000-0000-4000-8000-000000000003', 'operator' from public.workspace_members limit 1 $$, '42501', null, 'membership cannot be forged');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::int from public.projects), 0, 'cross-workspace content is hidden');
select throws_ok($$ select public.ensure_personal_workspace() from (select set_config('request.jwt.claim.sub', '', true)) s $$, null, null, 'RPC requires authentication');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok($$ update public.workspaces set name = 'Owner workspace' $$, 'owner updates workspace metadata');
select ok((select updated_by = '00000000-0000-4000-8000-000000000002'::uuid
  and cloud_updated_at >= cloud_created_at from public.projects where id = 'project-1'), 'audit fields are maintained');
select throws_ok($$ update public.projects set id = 'other' where id = 'project-1' $$, '22023', 'cloud entity identity is immutable', 'identity is immutable');
select throws_ok($$ insert into public.presets(workspace_id,id,name,payload,entity_created_at,entity_updated_at) select personal_workspace_id,'bad','Bad',jsonb_build_object('schemaVersion',2),now(),now() from public.profiles where id=auth.uid() $$, '23514', null, 'payload constraints are enforced');

select * from finish();
rollback;
