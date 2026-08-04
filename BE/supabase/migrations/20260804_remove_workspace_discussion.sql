begin;

-- The workspace Discussion module has been removed from the application.
-- Drop child tables first so this migration is safe regardless of the
-- foreign-key cascade configuration in an existing environment.
drop table if exists public.workspace_discussion_attachments cascade;
drop table if exists public.workspace_discussion_subtasks cascade;
drop table if exists public.workspace_discussion_comments cascade;
drop table if exists public.workspace_discussion_topics cascade;

commit;
