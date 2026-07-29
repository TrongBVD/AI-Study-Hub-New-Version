-- Keep ownership transfer atomic and align legacy document visibility with
-- the parent library.
create or replace function public.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_current_owner_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  select created_by into v_created_by
  from public.workspaces
  where id = p_workspace_id and deleted_at is null
  for update;

  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  if v_created_by <> p_current_owner_id then
    raise exception 'WORKSPACE_OWNER_REQUIRED';
  end if;
  if p_current_owner_id = p_target_user_id then
    raise exception 'TARGET_ALREADY_OWNER';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_target_user_id
  ) then
    raise exception 'TARGET_MEMBER_NOT_FOUND';
  end if;

  update public.workspace_members
  set role = 'Admin'
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  update public.workspace_members
  set role = 'Viewer'
  where workspace_id = p_workspace_id and user_id = p_current_owner_id;

  update public.workspaces
  set created_by = p_target_user_id
  where id = p_workspace_id;
end;
$$;

revoke all on function public.transfer_workspace_ownership(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.transfer_workspace_ownership(uuid, uuid, uuid)
to service_role;

create or replace function public.sync_library_document_visibility()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_public is distinct from old.is_public then
    update public.documents
    set is_public = new.is_public
    where library_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists libraries_sync_document_visibility
on public.libraries;

create trigger libraries_sync_document_visibility
after update of is_public on public.libraries
for each row
execute function public.sync_library_document_visibility();

create or replace function public.delete_owned_library(
  p_library_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select user_id into v_owner_id
  from public.libraries
  where id = p_library_id
  for update;

  if not found then
    raise exception 'LIBRARY_NOT_FOUND';
  end if;
  if v_owner_id <> p_user_id then
    raise exception 'LIBRARY_OWNER_REQUIRED';
  end if;

  delete from public.library_stars where library_id = p_library_id;
  delete from public.library_downloads where library_id = p_library_id;
  update public.documents
  set library_id = null, is_public = false
  where library_id = p_library_id;
  delete from public.libraries where id = p_library_id;
end;
$$;

revoke all on function public.delete_owned_library(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.delete_owned_library(uuid, uuid)
to service_role;

update public.documents as document
set is_public = false
from public.libraries as library
where document.library_id = library.id
  and library.is_public = false
  and document.is_public = true;
