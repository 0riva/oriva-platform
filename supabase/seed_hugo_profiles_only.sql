-- Simplified seed data for hugo_love.profiles table
-- This inserts profiles with proper JSONB structure

BEGIN;

-- Clear existing profiles
TRUNCATE TABLE hugo_love.profiles CASCADE;

-- Insert test profiles with JSONB profile_data
INSERT INTO hugo_love.profiles (user_id, app_id, profile_data, created_at, updated_at) VALUES
-- Alex
('00000000-0000-0000-0000-000000000001', 'hugo-love',
 '{"display_name": "Alex", "age": 28, "bio": "Love hiking, coffee, and deep conversations. Looking for someone who can keep up with my adventures!", "photo_urls": [], "interests": ["Hiking", "Coffee", "Travel", "Photography"]}',
 NOW(), NOW()),

-- Jordan
('00000000-0000-0000-0000-000000000002', 'hugo-love',
 '{"display_name": "Jordan", "age": 26, "bio": "Foodie, music lover, and weekend warrior. Let''s explore the city together!", "photo_urls": [], "interests": ["Food", "Music", "Concerts", "Cooking"]}',
 NOW(), NOW()),

-- Taylor
('00000000-0000-0000-0000-000000000003', 'hugo-love',
 '{"display_name": "Taylor", "age": 30, "bio": "Software engineer by day, artist by night. Seeking someone creative and curious.", "photo_urls": [], "interests": ["Technology", "Art", "Museums", "Reading"]}',
 NOW(), NOW()),

-- Sam
('00000000-0000-0000-0000-000000000004', 'hugo-love',
 '{"display_name": "Sam", "age": 27, "bio": "Fitness enthusiast and yoga instructor. Balance is key in life and relationships.", "photo_urls": [], "interests": ["Yoga", "Fitness", "Meditation", "Health"]}',
 NOW(), NOW()),

-- Morgan
('00000000-0000-0000-0000-000000000005', 'hugo-love',
 '{"display_name": "Morgan", "age": 29, "bio": "Book nerd and tea addict. Looking for my next great adventure (and maybe a reading partner).", "photo_urls": [], "interests": ["Reading", "Writing", "Tea", "Literature"]}',
 NOW(), NOW());

COMMIT;

-- Verify
SELECT
    user_id,
    profile_data->>'display_name' as name,
    profile_data->>'age' as age,
    profile_data->>'bio' as bio
FROM hugo_love.profiles
ORDER BY user_id;
