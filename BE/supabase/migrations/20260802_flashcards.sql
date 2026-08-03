-- Persistent AI-generated flashcards.
-- The explicit constraint names are used by PostgREST relationship selects.
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    constraint flashcards_document_id_fkey
    references public.documents(id) on delete cascade,
  workspace_id uuid
    constraint flashcards_workspace_id_fkey
    references public.workspaces(id) on delete set null,
  creator_id uuid not null
    constraint flashcards_creator_id_fkey
    references public.profiles(id) on delete cascade,
  question text not null check (length(trim(question)) > 0),
  answer text not null check (length(trim(answer)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists flashcards_document_created_idx
  on public.flashcards (document_id, created_at asc);

create index if not exists flashcards_workspace_created_idx
  on public.flashcards (workspace_id, created_at desc)
  where workspace_id is not null;

create index if not exists flashcards_creator_created_idx
  on public.flashcards (creator_id, created_at desc);

alter table public.flashcards enable row level security;

-- The application backend uses SUPABASE_SERVICE_ROLE_KEY and therefore
-- bypasses RLS. No direct client policies are intentionally granted here.

notify pgrst, 'reload schema';
