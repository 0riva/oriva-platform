-- Hugo Love Test Seed Data
-- Creates test profiles, ratings, and matches for development/testing
-- Run with: psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f seed_hugo_love_test_data.sql

-- Note: This assumes you have test users already created via Supabase Auth
-- For local development, you can create test users via the Supabase Studio UI

BEGIN;

-- Clean up existing test data (optional - comment out if you want to keep data)
TRUNCATE TABLE hugo_love.messages CASCADE;
TRUNCATE TABLE hugo_love.conversations CASCADE;
TRUNCATE TABLE hugo_love.matches CASCADE;
TRUNCATE TABLE hugo_love.ratings CASCADE;
TRUNCATE TABLE hugo_love.daily_swipe_counts CASCADE;
TRUNCATE TABLE hugo_love.profiles CASCADE;

-- Create test profiles
-- Note: Replace UUIDs with actual test user IDs from your Supabase Auth
-- You can get these by running: SELECT id, email FROM auth.users;

INSERT INTO hugo_love.profiles (user_id, display_name, age, bio, gender, location, interests, created_at, updated_at) VALUES
-- User 1: Alex
('00000000-0000-0000-0000-000000000001', 'Alex', 28, 'Love hiking, coffee, and deep conversations. Looking for someone who can keep up with my adventures!', 'non-binary', 'San Francisco, CA',
 ARRAY['Hiking', 'Coffee', 'Travel', 'Photography'], NOW(), NOW()),

-- User 2: Jordan
('00000000-0000-0000-0000-000000000002', 'Jordan', 26, 'Foodie, music lover, and weekend warrior. Let''s explore the city together!', 'non-binary', 'Oakland, CA',
 ARRAY['Food', 'Music', 'Concerts', 'Cooking'], NOW(), NOW()),

-- User 3: Taylor
('00000000-0000-0000-0000-000000000003', 'Taylor', 30, 'Software engineer by day, artist by night. Seeking someone creative and curious.', 'non-binary', 'Berkeley, CA',
 ARRAY['Technology', 'Art', 'Museums', 'Reading'], NOW(), NOW()),

-- User 4: Sam
('00000000-0000-0000-0000-000000000004', 'Sam', 27, 'Fitness enthusiast and yoga instructor. Balance is key in life and relationships.', 'non-binary', 'San Francisco, CA',
 ARRAY['Yoga', 'Fitness', 'Meditation', 'Health'], NOW(), NOW()),

-- User 5: Morgan
('00000000-0000-0000-0000-000000000005', 'Morgan', 29, 'Book nerd and tea addict. Looking for my next great adventure (and maybe a reading partner).', 'non-binary', 'San Francisco, CA',
 ARRAY['Reading', 'Writing', 'Tea', 'Literature'], NOW(), NOW());

-- Create test ratings
-- Alex rates Jordan (85/100)
INSERT INTO hugo_love.ratings (id, rater_id, rated_id, looks_score, personality_score, interests_score, lifestyle_score, overall_score, created_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 8, 9, 8, 9, 85, NOW());

-- Jordan rates Alex (88/100)
INSERT INTO hugo_love.ratings (id, rater_id, rated_id, looks_score, personality_score, interests_score, lifestyle_score, overall_score, created_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 9, 9, 8, 9, 88, NOW());

-- Create match between Alex and Jordan (both rated ≥80)
INSERT INTO hugo_love.matches (id, user_a_id, user_b_id, user_a_rating, user_b_rating, compatibility_score, status, matched_at, created_at, updated_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 85, 88, 87, 'active', NOW(), NOW(), NOW());

-- Alex rates Taylor (90/100)
INSERT INTO hugo_love.ratings (id, rater_id, rated_id, looks_score, personality_score, interests_score, lifestyle_score, overall_score, created_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 9, 9, 9, 9, 90, NOW());

-- Taylor rates Alex (92/100)
INSERT INTO hugo_love.ratings (id, rater_id, rated_id, looks_score, personality_score, interests_score, lifestyle_score, overall_score, created_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 9, 10, 9, 9, 92, NOW());

-- Create match between Alex and Taylor
INSERT INTO hugo_love.matches (id, user_a_id, user_b_id, user_a_rating, user_b_rating, compatibility_score, status, matched_at, created_at, updated_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 90, 92, 91, 'active', NOW(), NOW(), NOW());

-- Create conversations for matches
DO $$
DECLARE
    match1_id uuid;
    match2_id uuid;
    conv1_id uuid;
    conv2_id uuid;
BEGIN
    -- Get match IDs
    SELECT id INTO match1_id FROM hugo_love.matches
    WHERE user_a_id = '00000000-0000-0000-0000-000000000001'
      AND user_b_id = '00000000-0000-0000-0000-000000000002'
    LIMIT 1;

    SELECT id INTO match2_id FROM hugo_love.matches
    WHERE user_a_id = '00000000-0000-0000-0000-000000000001'
      AND user_b_id = '00000000-0000-0000-0000-000000000003'
    LIMIT 1;

    -- Create conversations
    INSERT INTO hugo_love.conversations (id, match_id, message_count, video_date_unlocked, extended_date_unlocked, last_message_at, created_at, updated_at)
    VALUES (gen_random_uuid(), match1_id, 0, false, false, NOW(), NOW(), NOW())
    RETURNING id INTO conv1_id;

    INSERT INTO hugo_love.conversations (id, match_id, message_count, video_date_unlocked, extended_date_unlocked, last_message_at, created_at, updated_at)
    VALUES (gen_random_uuid(), match2_id, 0, false, false, NOW(), NOW(), NOW())
    RETURNING id INTO conv2_id;

    -- Add some initial messages to conversation 1 (Alex <-> Jordan)
    INSERT INTO hugo_love.messages (id, conversation_id, sender_id, recipient_id, content, created_at) VALUES
    (gen_random_uuid(), conv1_id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
     'Hi Jordan! Great to match with you! 😊', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), conv1_id, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
     'Hey Alex! I loved your profile. Want to grab coffee this weekend?', NOW() - INTERVAL '1 hour 50 minutes'),
    (gen_random_uuid(), conv1_id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
     'Absolutely! I know a great spot in the Mission. How about Saturday at 2pm?', NOW() - INTERVAL '1 hour 40 minutes');

    -- Update conversation message count
    UPDATE hugo_love.conversations SET message_count = 3, last_message_at = NOW() - INTERVAL '1 hour 40 minutes' WHERE id = conv1_id;

    -- Add more messages to conversation 2 (Alex <-> Taylor) - unlock video date
    INSERT INTO hugo_love.messages (id, conversation_id, sender_id, recipient_id, content, created_at) VALUES
    (gen_random_uuid(), conv2_id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
     'Hey Taylor! Your art sounds amazing. What mediums do you work with?', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), conv2_id, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'Mostly digital and watercolor. I love the contrast between the two!', NOW() - INTERVAL '2 hours 50 minutes'),
    (gen_random_uuid(), conv2_id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
     'That sounds incredible. Do you have a portfolio online?', NOW() - INTERVAL '2 hours 40 minutes'),
    (gen_random_uuid(), conv2_id, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
     'I do! I''ll send you a link. What kind of software do you work on?', NOW() - INTERVAL '2 hours 30 minutes'),
    (gen_random_uuid(), conv2_id, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
     'I work on iOS apps. Actually building a dating app right now! 😅', NOW() - INTERVAL '2 hours 20 minutes');

    -- Update conversation message count (5 messages = unlock video date)
    UPDATE hugo_love.conversations SET message_count = 5, last_message_at = NOW() - INTERVAL '2 hours 20 minutes', video_date_unlocked = true WHERE id = conv2_id;
END $$;

-- Create daily swipe counts for testing
INSERT INTO hugo_love.daily_swipe_counts (id, user_id, date, swipe_count, created_at) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', CURRENT_DATE, 2, NOW()), -- Alex has 2 swipes today
(gen_random_uuid(), '00000000-0000-0000-0000-000000000002', CURRENT_DATE, 1, NOW()), -- Jordan has 1 swipe today
(gen_random_uuid(), '00000000-0000-0000-0000-000000000003', CURRENT_DATE, 1, NOW()); -- Taylor has 1 swipe today

COMMIT;

-- Verify data
SELECT 'Profiles created:' AS status, COUNT(*) AS count FROM hugo_love.profiles;
SELECT 'Ratings created:' AS status, COUNT(*) AS count FROM hugo_love.ratings;
SELECT 'Matches created:' AS status, COUNT(*) AS count FROM hugo_love.matches;
SELECT 'Conversations created:' AS status, COUNT(*) AS count FROM hugo_love.conversations;
SELECT 'Messages created:' AS status, COUNT(*) AS count FROM hugo_love.messages;
SELECT 'Daily swipe counts:' AS status, COUNT(*) AS count FROM hugo_love.daily_swipe_counts;

-- Show test user summary
SELECT
    p.display_name,
    p.age,
    p.location,
    COUNT(DISTINCT r.id) AS ratings_given,
    COUNT(DISTINCT m.id) AS matches,
    COUNT(DISTINCT c.id) AS conversations
FROM hugo_love.profiles p
LEFT JOIN hugo_love.ratings r ON r.rater_id = p.user_id
LEFT JOIN hugo_love.matches m ON m.user_a_id = p.user_id OR m.user_b_id = p.user_id
LEFT JOIN hugo_love.conversations c ON c.match_id = m.id
GROUP BY p.display_name, p.age, p.location
ORDER BY p.display_name;
