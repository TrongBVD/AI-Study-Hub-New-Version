-- Complete Schema Alignment Migration Script for Supabase Database
-- Run this script in your Supabase SQL Editor to add all missing columns, foreign keys, and indexes.

-- 1. Ensure tagging status columns exist on 'documents' table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tagging_status TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS tagging_error TEXT,
  ADD COLUMN IF NOT EXISTS tagging_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure admin review columns exist on 'documents' table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_review_reason TEXT;

-- 3. Ensure foreign key constraint from documents.uploader_id to profiles.id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_uploader_id_fkey'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_uploader_id_fkey
      FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Ensure document_tags table and foreign keys exist
CREATE TABLE IF NOT EXISTS public.document_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  level_1_tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  level_2_tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  level_3_tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT document_tags_document_id_key UNIQUE (document_id)
);

-- Ensure foreign key constraints for document_tags -> tags level 1, 2, 3
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_tags_level_1_tag_id_fkey') THEN
    ALTER TABLE public.document_tags ADD CONSTRAINT document_tags_level_1_tag_id_fkey
      FOREIGN KEY (level_1_tag_id) REFERENCES public.tags(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_tags_level_2_tag_id_fkey') THEN
    ALTER TABLE public.document_tags ADD CONSTRAINT document_tags_level_2_tag_id_fkey
      FOREIGN KEY (level_2_tag_id) REFERENCES public.tags(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_tags_level_3_tag_id_fkey') THEN
    ALTER TABLE public.document_tags ADD CONSTRAINT document_tags_level_3_tag_id_fkey
      FOREIGN KEY (level_3_tag_id) REFERENCES public.tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Force PostgREST schema cache reload so backend APIs pick up new columns immediately
NOTIFY pgrst, 'reload schema';
