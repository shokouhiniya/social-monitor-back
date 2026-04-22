-- Add caption_fa column for Farsi translations of non-Farsi posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption_fa TEXT;
