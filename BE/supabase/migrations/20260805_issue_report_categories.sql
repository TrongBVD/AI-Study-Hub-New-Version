alter table public.system_issue_reports
  drop constraint if exists system_issue_reports_category_check;

update public.system_issue_reports
set category = case category
  when 'DOCUMENT' then 'LIBRARY'
  when 'DISCOVER' then 'DISCOVERY'
  when 'AI' then 'AI_CHATBOT'
  when 'BUG' then 'OTHER'
  when 'ACCOUNT' then 'OTHER'
  else category
end;

alter table public.system_issue_reports
  add constraint system_issue_reports_category_check
  check (category in ('LIBRARY', 'WORKSPACE', 'DISCOVERY', 'AI_CHATBOT', 'OTHER'));

notify pgrst, 'reload schema';
