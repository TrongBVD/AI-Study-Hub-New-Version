alter table public.documents
  add column if not exists replacement_document_ids jsonb not null default '[]'::jsonb;

comment on column public.documents.replacement_document_ids is
  'Approved workspace document IDs to retire only after this pending replacement is approved.';
