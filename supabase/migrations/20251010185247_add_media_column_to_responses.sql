-- Add media column to responses table
-- Matches the entries table pattern: jsonb column with empty array default and GIN index

-- Add media column
ALTER TABLE responses
ADD COLUMN media jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add GIN index for efficient media querying
CREATE INDEX idx_responses_media ON responses USING gin (media);

-- Add comment for documentation
COMMENT ON COLUMN responses.media IS 'Array of media attachments (images, files) associated with this response. Stored as JSONB for flexible media metadata.';
