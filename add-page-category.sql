-- Add page_category column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_category VARCHAR(50);

-- Add client_keywords column for filtering relevant posts
ALTER TABLE pages ADD COLUMN IF NOT EXISTS client_keywords TEXT[];

-- Add is_relevant flag to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_relevant BOOLEAN DEFAULT true;

-- Update existing pages to be 'official' category
UPDATE pages SET page_category = 'official' WHERE page_category IS NULL;

-- Add comments
COMMENT ON COLUMN pages.page_category IS 'Category: official, news_agency, fan_pages, news_pages, local_sources, opposition_sources, foreign_sources';
COMMENT ON COLUMN pages.client_keywords IS 'Keywords to filter relevant posts (e.g., client name)';
COMMENT ON COLUMN posts.is_relevant IS 'Whether post is relevant to client (based on keyword matching)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_is_relevant ON posts(is_relevant);
CREATE INDEX IF NOT EXISTS idx_pages_page_category ON pages(page_category);
