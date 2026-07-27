-- System-admin-only permanent purge for workspaces that were soft-deleted first.
create or replace function public.admin_hard_delete_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workspace_name text;
  v_deleted_at timestamptz;
  v_deleted_document_count integer := 0;
  v_preserved_document_count integer := 0;
begin
  select name, deleted_at into v_workspace_name, v_deleted_at
  from public.workspaces where id = p_workspace_id for update;
  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  if v_deleted_at is null then raise exception 'WORKSPACE_NOT_SOFT_DELETED'; end if;

  select count(*) into v_deleted_document_count from public.documents
  where workspace_id = p_workspace_id and library_id is null;
  select count(*) into v_preserved_document_count from public.documents
  where workspace_id = p_workspace_id and library_id is not null;

  update public.documents set workspace_id = null
  where workspace_id = p_workspace_id and library_id is not null;
  delete from public.workspaces where id = p_workspace_id;

  return jsonb_build_object('workspaceId', p_workspace_id, 'workspaceName', v_workspace_name,
    'documentsDeleted', v_deleted_document_count, 'documentsPreserved', v_preserved_document_count);
end;
$$;

revoke all on function public.admin_hard_delete_workspace(uuid) from public, anon, authenticated;
grant execute on function public.admin_hard_delete_workspace(uuid) to service_role;
