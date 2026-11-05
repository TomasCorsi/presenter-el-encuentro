-- Phase 14: incremental local-first synchronization for Projects, Songs and Presets.

create sequence public.sync_change_sequence as bigint;

alter table public.projects
  add column sync_revision bigint,
  add column sync_change_seq bigint,
  add column last_operation_id uuid,
  add column deleted_at timestamptz;
alter table public.songs
  add column sync_revision bigint,
  add column sync_change_seq bigint,
  add column last_operation_id uuid,
  add column deleted_at timestamptz;
alter table public.presets
  add column sync_revision bigint,
  add column sync_change_seq bigint,
  add column last_operation_id uuid,
  add column deleted_at timestamptz;

update public.projects set sync_revision = 1, sync_change_seq = nextval('public.sync_change_sequence');
update public.songs set sync_revision = 1, sync_change_seq = nextval('public.sync_change_sequence');
update public.presets set sync_revision = 1, sync_change_seq = nextval('public.sync_change_sequence');

alter table public.projects
  alter column sync_revision set default 1, alter column sync_revision set not null,
  alter column sync_change_seq set default nextval('public.sync_change_sequence'), alter column sync_change_seq set not null;
alter table public.songs
  alter column sync_revision set default 1, alter column sync_revision set not null,
  alter column sync_change_seq set default nextval('public.sync_change_sequence'), alter column sync_change_seq set not null;
alter table public.presets
  alter column sync_revision set default 1, alter column sync_revision set not null,
  alter column sync_change_seq set default nextval('public.sync_change_sequence'), alter column sync_change_seq set not null;

create index projects_workspace_sync_change_idx on public.projects(workspace_id, sync_change_seq);
create index songs_workspace_sync_change_idx on public.songs(workspace_id, sync_change_seq);
create index presets_workspace_sync_change_idx on public.presets(workspace_id, sync_change_seq);

create or replace function private.audit_cloud_entity()
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
    new.sync_revision := 1;
    new.sync_change_seq := nextval('public.sync_change_sequence');
  else
    if new.workspace_id is distinct from old.workspace_id
      or new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.cloud_created_at is distinct from old.cloud_created_at
      or new.sync_revision is distinct from old.sync_revision
      or new.sync_change_seq is distinct from old.sync_change_seq then
      raise exception 'cloud entity identity or sync revision is immutable' using errcode = '22023';
    end if;
    new.updated_by := (select auth.uid());
    new.cloud_updated_at := now();
    new.sync_revision := old.sync_revision + 1;
    new.sync_change_seq := nextval('public.sync_change_sequence');
  end if;
  return new;
end;
$$;

revoke delete on public.projects, public.songs, public.presets from authenticated;
grant usage, select on sequence public.sync_change_sequence to authenticated;

create function public.apply_sync_change(
  target_workspace_id uuid,
  target_entity_type text,
  target_entity_id text,
  target_operation text,
  target_operation_id uuid,
  expected_revision bigint default null,
  target_record jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  table_name text;
  current_row jsonb;
  applied_row jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if target_entity_type not in ('project', 'song', 'preset') then
    raise exception 'invalid entity type' using errcode = '22023';
  end if;
  if target_operation not in ('upsert', 'delete') then
    raise exception 'invalid sync operation' using errcode = '22023';
  end if;
  if target_entity_type = 'preset' and target_entity_id = 'preset-default' then
    raise exception 'preset-default cannot be synchronized' using errcode = '23514';
  end if;
  table_name := case target_entity_type
    when 'project' then 'projects' when 'song' then 'songs' else 'presets' end;

  execute format('select to_jsonb(t) from public.%I t where workspace_id = $1 and id = $2', table_name)
    into current_row using target_workspace_id, target_entity_id;

  -- Lost responses are safe: idempotency is checked before CAS.
  if current_row is not null and current_row ->> 'last_operation_id' = target_operation_id::text then
    return jsonb_build_object('outcome', 'idempotent', 'row', current_row);
  end if;

  if current_row is null then
    if target_operation = 'delete' then
      return jsonb_build_object(
        'outcome', case when expected_revision is null then 'applied' else 'conflict' end,
        'row', null
      );
    end if;
    if expected_revision is not null then
      return jsonb_build_object('outcome', 'conflict', 'row', null);
    end if;
    if target_record is null then
      raise exception 'upsert requires target_record' using errcode = '22023';
    end if;
    if target_entity_type = 'song' then
      insert into public.songs (
        workspace_id, id, title, payload, entity_created_at, entity_updated_at, last_operation_id, deleted_at
      ) values (
        target_workspace_id, target_entity_id, target_record ->> 'title', target_record -> 'payload',
        (target_record ->> 'entity_created_at')::timestamptz,
        (target_record ->> 'entity_updated_at')::timestamptz, target_operation_id, null
      ) returning to_jsonb(public.songs.*) into applied_row;
    elsif target_entity_type = 'project' then
      insert into public.projects (
        workspace_id, id, name, payload, entity_created_at, entity_updated_at, last_operation_id, deleted_at
      ) values (
        target_workspace_id, target_entity_id, target_record ->> 'name', target_record -> 'payload',
        (target_record ->> 'entity_created_at')::timestamptz,
        (target_record ->> 'entity_updated_at')::timestamptz, target_operation_id, null
      ) returning to_jsonb(public.projects.*) into applied_row;
    else
      insert into public.presets (
        workspace_id, id, name, payload, entity_created_at, entity_updated_at, last_operation_id, deleted_at
      ) values (
        target_workspace_id, target_entity_id, target_record ->> 'name', target_record -> 'payload',
        (target_record ->> 'entity_created_at')::timestamptz,
        (target_record ->> 'entity_updated_at')::timestamptz, target_operation_id, null
      ) returning to_jsonb(public.presets.*) into applied_row;
    end if;
    return jsonb_build_object('outcome', 'applied', 'row', applied_row);
  end if;

  if expected_revision is null or (current_row ->> 'sync_revision')::bigint <> expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'row', current_row);
  end if;

  if target_operation = 'delete' then
    execute format(
      'update public.%I set deleted_at = now(), last_operation_id = $3 where workspace_id = $1 and id = $2 returning to_jsonb(%I.*)',
      table_name, table_name
    ) into applied_row using target_workspace_id, target_entity_id, target_operation_id;
  elsif target_entity_type = 'song' then
    update public.songs set
      title = target_record ->> 'title', payload = target_record -> 'payload',
      entity_created_at = (target_record ->> 'entity_created_at')::timestamptz,
      entity_updated_at = (target_record ->> 'entity_updated_at')::timestamptz,
      deleted_at = null, last_operation_id = target_operation_id
    where workspace_id = target_workspace_id and id = target_entity_id
    returning to_jsonb(public.songs.*) into applied_row;
  elsif target_entity_type = 'project' then
    update public.projects set
      name = target_record ->> 'name', payload = target_record -> 'payload',
      entity_created_at = (target_record ->> 'entity_created_at')::timestamptz,
      entity_updated_at = (target_record ->> 'entity_updated_at')::timestamptz,
      deleted_at = null, last_operation_id = target_operation_id
    where workspace_id = target_workspace_id and id = target_entity_id
    returning to_jsonb(public.projects.*) into applied_row;
  else
    update public.presets set
      name = target_record ->> 'name', payload = target_record -> 'payload',
      entity_created_at = (target_record ->> 'entity_created_at')::timestamptz,
      entity_updated_at = (target_record ->> 'entity_updated_at')::timestamptz,
      deleted_at = null, last_operation_id = target_operation_id
    where workspace_id = target_workspace_id and id = target_entity_id
    returning to_jsonb(public.presets.*) into applied_row;
  end if;
  return jsonb_build_object('outcome', 'applied', 'row', applied_row);
exception when unique_violation then
  execute format('select to_jsonb(t) from public.%I t where workspace_id = $1 and id = $2', table_name)
    into current_row using target_workspace_id, target_entity_id;
  if current_row ->> 'last_operation_id' = target_operation_id::text then
    return jsonb_build_object('outcome', 'idempotent', 'row', current_row);
  end if;
  return jsonb_build_object('outcome', 'conflict', 'row', current_row);
end;
$$;

revoke all on function public.apply_sync_change(uuid, text, text, text, uuid, bigint, jsonb)
  from public, anon;
grant execute on function public.apply_sync_change(uuid, text, text, text, uuid, bigint, jsonb)
  to authenticated;
