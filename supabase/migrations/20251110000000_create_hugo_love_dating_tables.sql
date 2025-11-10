-- Hugo Love Dating Features (T058-T060)
-- Tables for swipes, ratings, matches, and blocking functionality
-- All tables use RLS for security

-- ============================================================================
-- SWIPES TABLE (T058 - FotoFlash)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "hugo_love"."swipes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "direction" TEXT NOT NULL CHECK (direction IN ('like', 'dislike', 'review')),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT "swipes_no_self_swipe" CHECK (user_id != target_user_id),
    CONSTRAINT "swipes_one_per_target" UNIQUE (user_id, target_user_id)
);

ALTER TABLE "hugo_love"."swipes" OWNER TO "postgres";

COMMENT ON TABLE "hugo_love"."swipes" IS 'User swipe actions (like/dislike/review) for dating profiles';
COMMENT ON COLUMN "hugo_love"."swipes"."direction" IS 'Swipe direction: like, dislike, or review';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_swipes_user_id" ON "hugo_love"."swipes" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_swipes_target_user_id" ON "hugo_love"."swipes" ("target_user_id");
CREATE INDEX IF NOT EXISTS "idx_swipes_direction" ON "hugo_love"."swipes" ("direction");
CREATE INDEX IF NOT EXISTS "idx_swipes_timestamp" ON "hugo_love"."swipes" ("timestamp" DESC);

-- RLS Policies
ALTER TABLE "hugo_love"."swipes" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own swipes
CREATE POLICY "users_can_insert_own_swipes" ON "hugo_love"."swipes"
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own swipes
CREATE POLICY "users_can_view_own_swipes" ON "hugo_love"."swipes"
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view swipes they received (for match detection)
CREATE POLICY "users_can_view_received_swipes" ON "hugo_love"."swipes"
    FOR SELECT
    USING (auth.uid() = target_user_id);

-- Users can update their own swipes (e.g., change from dislike to like)
CREATE POLICY "users_can_update_own_swipes" ON "hugo_love"."swipes"
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RATINGS TABLE (T059 - RateTheBait)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "hugo_love"."ratings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rater_id" UUID NOT NULL,
    "rated_user_id" UUID NOT NULL,
    "looks" INTEGER NOT NULL CHECK (looks BETWEEN 1 AND 5),
    "personality" INTEGER NOT NULL CHECK (personality BETWEEN 1 AND 5),
    "interests" INTEGER NOT NULL CHECK (interests BETWEEN 1 AND 5),
    "lifestyle" INTEGER NOT NULL CHECK (lifestyle BETWEEN 1 AND 5),
    "average_score" NUMERIC(3,1) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT "ratings_no_self_rating" CHECK (rater_id != rated_user_id),
    CONSTRAINT "ratings_one_per_user" UNIQUE (rater_id, rated_user_id),
    CONSTRAINT "ratings_comment_length" CHECK (length(comment) <= 500)
);

ALTER TABLE "hugo_love"."ratings" OWNER TO "postgres";

COMMENT ON TABLE "hugo_love"."ratings" IS 'User ratings for dating profiles (1-5 stars on 4 factors)';
COMMENT ON COLUMN "hugo_love"."ratings"."average_score" IS 'Average of looks, personality, interests, lifestyle ratings';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_ratings_rater_id" ON "hugo_love"."ratings" ("rater_id");
CREATE INDEX IF NOT EXISTS "idx_ratings_rated_user_id" ON "hugo_love"."ratings" ("rated_user_id");
CREATE INDEX IF NOT EXISTS "idx_ratings_average_score" ON "hugo_love"."ratings" ("average_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_ratings_created_at" ON "hugo_love"."ratings" ("created_at" DESC);

-- RLS Policies
ALTER TABLE "hugo_love"."ratings" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own ratings
CREATE POLICY "users_can_insert_own_ratings" ON "hugo_love"."ratings"
    FOR INSERT
    WITH CHECK (auth.uid() = rater_id);

-- Users can view their own ratings (that they gave)
CREATE POLICY "users_can_view_own_ratings" ON "hugo_love"."ratings"
    FOR SELECT
    USING (auth.uid() = rater_id);

-- Users can view ratings they received (for stats)
CREATE POLICY "users_can_view_received_ratings" ON "hugo_love"."ratings"
    FOR SELECT
    USING (auth.uid() = rated_user_id);

-- ============================================================================
-- MATCHES TABLE (T060 - CatchTheMatch)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "hugo_love"."matches" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id_1" UUID NOT NULL,
    "user_id_2" UUID NOT NULL,
    "conversation_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'blocked')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT "matches_ordered_user_ids" CHECK (user_id_1 < user_id_2),
    CONSTRAINT "matches_unique_pair" UNIQUE (user_id_1, user_id_2)
);

ALTER TABLE "hugo_love"."matches" OWNER TO "postgres";

COMMENT ON TABLE "hugo_love"."matches" IS 'Mutual likes between users (auto-created by trigger)';
COMMENT ON COLUMN "hugo_love"."matches"."user_id_1" IS 'Lower UUID (ensures consistent ordering)';
COMMENT ON COLUMN "hugo_love"."matches"."user_id_2" IS 'Higher UUID (ensures consistent ordering)';
COMMENT ON COLUMN "hugo_love"."matches"."conversation_id" IS 'DM conversation for this match';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_matches_user_id_1" ON "hugo_love"."matches" ("user_id_1");
CREATE INDEX IF NOT EXISTS "idx_matches_user_id_2" ON "hugo_love"."matches" ("user_id_2");
CREATE INDEX IF NOT EXISTS "idx_matches_status" ON "hugo_love"."matches" ("status");
CREATE INDEX IF NOT EXISTS "idx_matches_created_at" ON "hugo_love"."matches" ("created_at" DESC);

-- RLS Policies
ALTER TABLE "hugo_love"."matches" ENABLE ROW LEVEL SECURITY;

-- Users can view matches they're part of
CREATE POLICY "users_can_view_own_matches" ON "hugo_love"."matches"
    FOR SELECT
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- System can insert matches (via trigger)
CREATE POLICY "system_can_insert_matches" ON "hugo_love"."matches"
    FOR INSERT
    WITH CHECK (true);

-- Users can update status of their own matches
CREATE POLICY "users_can_update_own_matches" ON "hugo_love"."matches"
    FOR UPDATE
    USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2)
    WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- ============================================================================
-- BLOCKS TABLE (T060 - Privacy Controls)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "hugo_love"."blocks" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT "blocks_no_self_block" CHECK (blocker_id != blocked_id),
    CONSTRAINT "blocks_unique_pair" UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE "hugo_love"."blocks" OWNER TO "postgres";

COMMENT ON TABLE "hugo_love"."blocks" IS 'User blocking for privacy and safety';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_blocks_blocker_id" ON "hugo_love"."blocks" ("blocker_id");
CREATE INDEX IF NOT EXISTS "idx_blocks_blocked_id" ON "hugo_love"."blocks" ("blocked_id");

-- RLS Policies
ALTER TABLE "hugo_love"."blocks" ENABLE ROW LEVEL SECURITY;

-- Users can insert their own blocks
CREATE POLICY "users_can_insert_own_blocks" ON "hugo_love"."blocks"
    FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

-- Users can view their own blocks
CREATE POLICY "users_can_view_own_blocks" ON "hugo_love"."blocks"
    FOR SELECT
    USING (auth.uid() = blocker_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "users_can_delete_own_blocks" ON "hugo_love"."blocks"
    FOR DELETE
    USING (auth.uid() = blocker_id);

-- ============================================================================
-- TRIGGERS: Auto-create matches on mutual likes
-- ============================================================================

CREATE OR REPLACE FUNCTION hugo_love.create_match_on_mutual_like()
RETURNS TRIGGER AS $$
DECLARE
    v_other_swipe RECORD;
    v_user_1 UUID;
    v_user_2 UUID;
BEGIN
    -- Only process 'like' swipes
    IF NEW.direction != 'like' THEN
        RETURN NEW;
    END IF;

    -- Check if target user has also liked this user
    SELECT * INTO v_other_swipe
    FROM hugo_love.swipes
    WHERE user_id = NEW.target_user_id
      AND target_user_id = NEW.user_id
      AND direction = 'like';

    -- If mutual like exists, create match
    IF FOUND THEN
        -- Order user IDs consistently (lower UUID first)
        IF NEW.user_id < NEW.target_user_id THEN
            v_user_1 := NEW.user_id;
            v_user_2 := NEW.target_user_id;
        ELSE
            v_user_1 := NEW.target_user_id;
            v_user_2 := NEW.user_id;
        END IF;

        -- Insert match (ignore if already exists)
        INSERT INTO hugo_love.matches (user_id_1, user_id_2, status)
        VALUES (v_user_1, v_user_2, 'active')
        ON CONFLICT (user_id_1, user_id_2) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION hugo_love.create_match_on_mutual_like() OWNER TO "postgres";

COMMENT ON FUNCTION hugo_love.create_match_on_mutual_like() IS 'Auto-creates match when two users like each other';

-- Attach trigger to swipes table
DROP TRIGGER IF EXISTS trigger_create_match_on_mutual_like ON hugo_love.swipes;
CREATE TRIGGER trigger_create_match_on_mutual_like
    AFTER INSERT ON hugo_love.swipes
    FOR EACH ROW
    EXECUTE FUNCTION hugo_love.create_match_on_mutual_like();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get match statistics for a user
CREATE OR REPLACE FUNCTION hugo_love.get_user_match_stats(p_user_id UUID)
RETURNS TABLE (
    total_matches BIGINT,
    active_matches BIGINT,
    total_likes_sent BIGINT,
    total_likes_received BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM hugo_love.matches
         WHERE (user_id_1 = p_user_id OR user_id_2 = p_user_id)) AS total_matches,
        (SELECT COUNT(*) FROM hugo_love.matches
         WHERE (user_id_1 = p_user_id OR user_id_2 = p_user_id) AND status = 'active') AS active_matches,
        (SELECT COUNT(*) FROM hugo_love.swipes
         WHERE user_id = p_user_id AND direction = 'like') AS total_likes_sent,
        (SELECT COUNT(*) FROM hugo_love.swipes
         WHERE target_user_id = p_user_id AND direction = 'like') AS total_likes_received;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION hugo_love.get_user_match_stats(UUID) OWNER TO "postgres";

COMMENT ON FUNCTION hugo_love.get_user_match_stats(UUID) IS 'Get match and swipe statistics for a user';

-- Function to get average ratings for a user
CREATE OR REPLACE FUNCTION hugo_love.get_user_rating_stats(p_user_id UUID)
RETURNS TABLE (
    total_ratings BIGINT,
    avg_looks NUMERIC,
    avg_personality NUMERIC,
    avg_interests NUMERIC,
    avg_lifestyle NUMERIC,
    avg_overall NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_ratings,
        ROUND(AVG(looks)::NUMERIC, 1) AS avg_looks,
        ROUND(AVG(personality)::NUMERIC, 1) AS avg_personality,
        ROUND(AVG(interests)::NUMERIC, 1) AS avg_interests,
        ROUND(AVG(lifestyle)::NUMERIC, 1) AS avg_lifestyle,
        ROUND(AVG(average_score)::NUMERIC, 1) AS avg_overall
    FROM hugo_love.ratings
    WHERE rated_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION hugo_love.get_user_rating_stats(UUID) OWNER TO "postgres";

COMMENT ON FUNCTION hugo_love.get_user_rating_stats(UUID) IS 'Get average ratings for a user across all factors';
