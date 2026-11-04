create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  personal_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'operator')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'schemaVersion' = '1'
    and pg_column_size(payload) <= 1048576
  ),
  entity_created_at timestamptz not null,
  entity_updated_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  cloud_created_at timestamptz not null default now(),
  cloud_updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.songs (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'schemaVersion' = '1'
    and pg_column_size(payload) <= 1048576
  ),
  entity_created_at timestamptz not null,
  entity_updated_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  cloud_created_at timestamptz not null default now(),
  cloud_updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.presets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'schemaVersion' = '1'
    and pg_column_size(payload) <= 1048576
  ),
  entity_created_at timestamptz not null,
  entity_updated_at timestamptz not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  cloud_created_at timestamptz not null default now(),
  cloud_updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspaces_created_by_idx on public.workspaces(created_by);
create index projects_workspace_cloud_updated_idx on public.projects(workspace_id, cloud_updated_at desc);
create index projects_workspace_name_idx on public.projects(workspace_id, lower(name));
create index songs_workspace_cloud_updated_idx on public.songs(workspace_id, cloud_updated_at desc);
create index songs_workspace_title_idx on public.songs(workspace_id, lower(title));
create index presets_workspace_cloud_updated_idx on public.presets(workspace_id, cloud_updated_at desc);
create index presets_workspace_name_idx on public.presets(workspace_id, lower(name));

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = (select auth.uid())
  );
$$;

create function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.is_workspace_owner(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;

create function private.touch_workspace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'workspace identity is immutable' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger workspaces_touch_before_update
before update on public.workspaces
for each row execute function private.touch_workspace();

create function private.touch_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.personal_workspace_id is distinct from old.personal_workspace_id
    or new.created_at is distinct from old.created_at then
    raise exception 'profile identity is immutable' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_before_update
before update on public.profiles
for each row execute function private.touch_profile();

create function private.audit_cloud_entity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.cloud_created_at := now();
    new.cloud_updated_at := now();
  else
    if new.workspace_id is distinct from old.workspace_id
      or new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.cloud_created_at is distinct from old.cloud_created_at then
      raise exception 'cloud entity identity is immutable' using errcode = '22023';
    end if;
    new.updated_by := (select auth.uid());
    new.cloud_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger projects_audit_before_write before insert or update on public.projects
for each row execute function private.audit_cloud_entity();
create trigger songs_audit_before_write before insert or update on public.songs
for each row execute function private.audit_cloud_entity();
create trigger presets_audit_before_write before insert or update on public.presets
for each row execute function private.audit_cloud_entity();

revoke all on function private.touch_workspace() from public, anon, authenticated;
revoke all on function private.touch_profile() from public, anon, authenticated;
revoke all on function private.audit_cloud_entity() from public, anon, authenticated;

create function public.ensure_personal_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_workspace_id uuid;
  workspace_row public.workspaces%rowtype;
  profile_row public.profiles%rowtype;
  membership_row public.workspace_members%rowtype;
  email_value text;
  display_value text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  email_value := coalesce(nullif((select auth.jwt()) ->> 'email', ''), 'usuario');
  display_value := left(split_part(email_value, '@', 1), 100);

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  select personal_workspace_id into existing_workspace_id
    from public.profiles where id = current_user_id for update;

  if existing_workspace_id is null then
    insert into public.workspaces(name, created_by)
      values (left('Workspace de ' || display_value, 100), current_user_id)
      returning * into workspace_row;

    insert into public.profiles(id, display_name, personal_workspace_id)
      values (current_user_id, display_value, workspace_row.id)
      on conflict (id) do update set
        personal_workspace_id = excluded.personal_workspace_id,
        updated_at = now()
      returning * into profile_row;
  else
    select * into workspace_row from public.workspaces where id = existing_workspace_id;
    select * into profile_row from public.profiles where id = current_user_id;
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
    values (workspace_row.id, current_user_id, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner'
    returning * into membership_row;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile_row.id,
      'displayName', profile_row.display_name,
      'personalWorkspaceId', profile_row.personal_workspace_id
    ),
    'workspace', jsonb_build_object(
      'id', workspace_row.id,
      'name', workspace_row.name,
      'createdAt', workspace_row.created_at,
      'updatedAt', workspace_row.updated_at
    ),
    'membership', jsonb_build_object(
      'workspaceId', membership_row.workspace_id,
      'userId', membership_row.user_id,
      'role', membership_row.role,
      'createdAt', membership_row.created_at
    )
  );
end;
$$;

revoke all on function public.ensure_personal_workspace() from public, anon;
grant execute on function public.ensure_personal_workspace() to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.songs enable row level security;
alter table public.presets enable row level security;

revoke all on table public.profiles, public.workspaces, public.workspace_members,
  public.projects, public.songs, public.presets from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects, public.songs, public.presets to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy workspaces_select_member on public.workspaces for select to authenticated
using ((select private.is_workspace_member(id)));
create policy workspaces_update_owner on public.workspaces for update to authenticated
using ((select private.is_workspace_owner(id)))
with check ((select private.is_workspace_owner(id)));

create policy workspace_members_select_member on public.workspace_members for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy projects_select_member on public.projects for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy projects_insert_member on public.projects for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy projects_update_member on public.projects for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));
create policy projects_delete_member on public.projects for delete to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy songs_select_member on public.songs for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy songs_insert_member on public.songs for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy songs_update_member on public.songs for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));
create policy songs_delete_member on public.songs for delete to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy presets_select_member on public.presets for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy presets_insert_member on public.presets for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)) and created_by = (select auth.uid()));
create policy presets_update_member on public.presets for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));
create policy presets_delete_member on public.presets for delete to authenticated
using ((select private.is_workspace_member(workspace_id)));
