-- Migration: Split 'Physics, Chemistry, Biology' into 3 separate Level 1 tags

BEGIN;

-- 1. Insert Physics, Chemistry, Biology as individual Level 1 tags if not present
INSERT INTO public.tags (name, level, parent_id)
SELECT 'Physics', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'Physics' AND level = 1);

INSERT INTO public.tags (name, level, parent_id)
SELECT 'Chemistry', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'Chemistry' AND level = 1);

INSERT INTO public.tags (name, level, parent_id)
SELECT 'Biology', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'Biology' AND level = 1);

-- 2. Migrate existing document_tags and child tags from the old merged tag if present
DO $$
DECLARE
  old_tag_id UUID;
  phys_id UUID;
  chem_id UUID;
  bio_id UUID;
BEGIN
  SELECT id INTO old_tag_id FROM public.tags WHERE name = 'Physics, Chemistry, Biology' AND level = 1 LIMIT 1;
  SELECT id INTO phys_id FROM public.tags WHERE name = 'Physics' AND level = 1 LIMIT 1;
  SELECT id INTO chem_id FROM public.tags WHERE name = 'Chemistry' AND level = 1 LIMIT 1;
  SELECT id INTO bio_id FROM public.tags WHERE name = 'Biology' AND level = 1 LIMIT 1;

  IF old_tag_id IS NOT NULL THEN
    -- Update document_tags referencing old tag
    UPDATE public.document_tags
    SET level_1_tag_id = phys_id
    WHERE level_1_tag_id = old_tag_id;

    -- Update parent_id for Level 2 tags
    UPDATE public.tags
    SET parent_id = phys_id
    WHERE parent_id = old_tag_id;

    -- Delete old merged tag
    DELETE FROM public.tags WHERE id = old_tag_id;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
