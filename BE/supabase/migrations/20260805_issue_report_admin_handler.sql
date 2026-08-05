alter table public.system_issue_reports
  add column if not exists handled_by_admin_id uuid
  references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';
