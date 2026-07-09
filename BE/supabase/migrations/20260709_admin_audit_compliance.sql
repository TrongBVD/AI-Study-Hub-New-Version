-- Admin audit metadata required by FR-ADM-05 and FR-AUD-01.
alter table public.activity_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device text,
  add column if not exists risk_level text not null default 'INFO',
  add column if not exists details text;

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_action_type_idx
  on public.activity_logs (action_type);

create index if not exists documents_admin_moderation_idx
  on public.documents (status, created_at desc)
  where deleted_at is null;

create index if not exists profiles_admin_sort_idx
  on public.profiles (last_login_at desc);

create index if not exists daily_quota_usage_admin_idx
  on public.daily_quota_usage (usage_date desc, user_id);

create index if not exists ai_usage_logs_admin_idx
  on public.ai_usage_logs (usage_date desc, user_id);
