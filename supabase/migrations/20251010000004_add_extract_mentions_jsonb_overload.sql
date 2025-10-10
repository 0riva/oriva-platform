-- Migration: Add JSONB overload for extract_mentions_from_content
-- Fix: PostgreSQL error "function extract_mentions_from_content(jsonb) does not exist"
-- Issue: Base schema defines extract_mentions_from_content(TEXT) but entries.content is JSONB
-- Solution: Create JSONB overload that converts to text and calls existing TEXT version

-- Create JSONB overload of extract_mentions_from_content
CREATE OR REPLACE FUNCTION "public"."extract_mentions_from_content"("content" "jsonb")
RETURNS "text"[]
LANGUAGE "plpgsql" IMMUTABLE
AS $$
BEGIN
  -- Convert JSONB to text and call existing TEXT version
  -- This handles the case where content is stored as JSONB in entries table
  RETURN extract_mentions_from_content(content::text);
END;
$$;

-- Set ownership
ALTER FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") OWNER TO "postgres";

-- Grant permissions to match existing TEXT version
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "service_role";

-- Comment explaining the overload
COMMENT ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") IS
'JSONB overload for extract_mentions_from_content. Converts JSONB content to text and delegates to TEXT version. Required because entries.content is JSONB type.';
