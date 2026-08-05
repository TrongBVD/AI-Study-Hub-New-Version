alter table public.system_issue_reports
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Preserve metadata if the earlier attachment-table migration was already applied.
do $$
begin
  if to_regclass('public.system_issue_report_attachments') is not null then
    update public.system_issue_reports reports
    set attachments = coalesce(source.files, '[]'::jsonb)
    from (
      select report_id, jsonb_agg(jsonb_build_object(
        'id', id,
        'storage_path', storage_path,
        'file_name', file_name,
        'mime_type', mime_type,
        'file_size', file_size,
        'created_at', created_at
      ) order by created_at) as files
      from public.system_issue_report_attachments
      group by report_id
    ) source
    where reports.id = source.report_id;

    drop table public.system_issue_report_attachments;
  end if;
end $$;

alter table public.system_issue_reports
  drop column if exists steps_to_reproduce;

drop index if exists public.system_issue_reports_priority_idx;

alter table public.system_issue_reports
  drop column if exists priority;

insert into storage.buckets (id, name, public, file_size_limit)
values ('issue-report-attachments', 'issue-report-attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
