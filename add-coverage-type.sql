-- Add coverage_type column to posts table for non-official sources
ALTER TABLE posts ADD COLUMN IF NOT EXISTS coverage_type VARCHAR(50);

-- Add comment
COMMENT ON COLUMN posts.coverage_type IS 'How the source covers the client: quote, criticism, praise, neutral_mention, analysis, interview, etc.';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_posts_coverage_type ON posts(coverage_type);
