-- Fix responses table unique constraint to allow multiple response types per user per entry
-- Current: (entry_id, user_id) - prevents ANY multiple responses
-- New: (entry_id, user_id, response_type) - allows one response PER TYPE

-- Drop the overly restrictive constraint
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_entry_id_user_id_key;

-- Add the correct constraint: one response per type per user per entry
ALTER TABLE responses ADD CONSTRAINT responses_entry_id_user_id_type_key
  UNIQUE (entry_id, user_id, response_type);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT responses_entry_id_user_id_type_key ON responses IS
  'Ensures a user can submit one response per type (moderate, curate, iterate, applaud) per entry';
