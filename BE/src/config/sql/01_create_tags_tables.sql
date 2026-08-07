-- Migration: 01_create_tags_tables.sql
-- Description: Create 3-level tags hierarchy and document_tags tables with hardcoded Level 1 seed subjects.

CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
    parent_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tag_per_level_parent UNIQUE (name, level, parent_id)
);

CREATE TABLE IF NOT EXISTS public.document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE CASCADE,
    level_1_tag_id UUID NOT NULL REFERENCES public.tags(id),
    level_2_tag_id UUID REFERENCES public.tags(id),
    level_3_tag_id UUID REFERENCES public.tags(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast discovery & tag lookup
CREATE INDEX IF NOT EXISTS idx_tags_level_name ON public.tags(level, name);
CREATE INDEX IF NOT EXISTS idx_document_tags_doc_id ON public.document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_l1 ON public.document_tags(level_1_tag_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_l2 ON public.document_tags(level_2_tag_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_l3 ON public.document_tags(level_3_tag_id);

-- Seed Level 1 Hardcoded Subjects
INSERT INTO public.tags (name, level, parent_id) VALUES
('Literature', 1, NULL),
('Mathematics', 1, NULL),
('History', 1, NULL),
('Languages', 1, NULL),
('Geography', 1, NULL),
('Physics', 1, NULL),
('Chemistry', 1, NULL),
('Biology', 1, NULL),
('Information Technology', 1, NULL),
('Engineering & Technology: Engineering', 1, NULL),
('Architecture', 1, NULL),
('Economics', 1, NULL),
('Business Administration', 1, NULL),
('Finance & Banking', 1, NULL),
('Medicine', 1, NULL),
('Law', 1, NULL),
('Other', 1, NULL)
ON CONFLICT DO NOTHING;
