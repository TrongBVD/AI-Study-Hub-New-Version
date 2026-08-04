-- Track hierarchical AI tagging independently from document moderation.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tagging_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS tagging_error TEXT,
  ADD COLUMN IF NOT EXISTS tagging_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_tagging_status_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_tagging_status_check
      CHECK (tagging_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));
  END IF;
END $$;

UPDATE public.documents AS document
SET
  tagging_status = 'COMPLETED',
  tagging_error = NULL,
  tagging_updated_at = COALESCE(document_tag.created_at, NOW())
FROM public.document_tags AS document_tag
WHERE document_tag.document_id = document.id;

UPDATE public.documents AS document
SET
  tagging_status = 'FAILED',
  tagging_error = 'Tags have not been generated for this existing document.',
  tagging_updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.document_tags AS document_tag
  WHERE document_tag.document_id = document.id
);

CREATE INDEX IF NOT EXISTS idx_documents_tagging_status
  ON public.documents(tagging_status);
