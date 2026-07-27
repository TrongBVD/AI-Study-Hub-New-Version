create table if not exists public.system_issue_reports (
  id uuid primary key default gen_random_uuid(), reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category in ('BUG','ACCOUNT','WORKSPACE','DOCUMENT','AI','OTHER')),
  title text not null check (char_length(btrim(title)) between 5 and 150), description text not null check (char_length(btrim(description)) between 20 and 5000),
  steps_to_reproduce text, page_path text, status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','DISMISSED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','CRITICAL')), admin_note text,
  handled_by_admin_id uuid references public.profiles(id) on delete set null, resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists system_issue_reports_reporter_idx on public.system_issue_reports(reporter_user_id, created_at desc);
create index if not exists system_issue_reports_queue_idx on public.system_issue_reports(status, created_at desc);
create index if not exists system_issue_reports_priority_idx on public.system_issue_reports(priority);
