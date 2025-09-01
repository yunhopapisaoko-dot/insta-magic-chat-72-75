-- Add caption position and size to stories
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS text_position TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS text_size INTEGER NOT NULL DEFAULT 24;

-- Optional: basic validation via CHECK constraints (non-strict for compatibility)
-- Note: keeping it simple to avoid breaking existing inserts; client will control values.
