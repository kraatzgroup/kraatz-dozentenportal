-- Migration: Add schwerpunkt_tags column to material_folders
-- Description: Allows admins and material role users to tag klausur-folders
-- with multiple schwerpunkt tags for better classification.

ALTER TABLE public.material_folders
  ADD COLUMN IF NOT EXISTS schwerpunkt_tags TEXT[] DEFAULT '{}';

-- Index for fast tag-based filtering
CREATE INDEX IF NOT EXISTS idx_material_folders_schwerpunkt_tags
  ON public.material_folders USING GIN (schwerpunkt_tags);
