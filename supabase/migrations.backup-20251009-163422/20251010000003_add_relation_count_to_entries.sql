-- Migration: Add relation_count to entries table with trigger
-- Task: T003
-- Description: Maintain relation count on entries table for performance

-- Add relation_count column to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS relation_count INTEGER DEFAULT 0 CHECK (relation_count >= 0);

-- Create trigger function to update relation_count
CREATE OR REPLACE FUNCTION update_entry_relation_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Increment count for both source and target entries
        UPDATE entries SET relation_count = relation_count + 1
        WHERE id = NEW.source_entry_id OR id = NEW.target_entry_id;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- If active status changed
        IF (OLD.active != NEW.active) THEN
            IF (NEW.active = TRUE) THEN
                -- Relation activated: increment counts
                UPDATE entries SET relation_count = relation_count + 1
                WHERE id = NEW.source_entry_id OR id = NEW.target_entry_id;
            ELSE
                -- Relation deactivated: decrement counts
                UPDATE entries SET relation_count = GREATEST(0, relation_count - 1)
                WHERE id = NEW.source_entry_id OR id = NEW.target_entry_id;
            END IF;
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        -- Decrement count only if relation was active
        IF (OLD.active = TRUE) THEN
            UPDATE entries SET relation_count = GREATEST(0, relation_count - 1)
            WHERE id = OLD.source_entry_id OR id = OLD.target_entry_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on entry_relations table
DROP TRIGGER IF EXISTS entry_relations_update_count_trigger ON entry_relations;
CREATE TRIGGER entry_relations_update_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON entry_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_entry_relation_count();

-- Initialize relation_count for existing entries
UPDATE entries e
SET relation_count = (
    SELECT COUNT(*)
    FROM entry_relations er
    WHERE
        er.active = TRUE
        AND (er.source_entry_id = e.id OR er.target_entry_id = e.id)
);

-- Comment on column
COMMENT ON COLUMN entries.relation_count IS 'Cached count of active entry relations for performance (auto-maintained by trigger)';
