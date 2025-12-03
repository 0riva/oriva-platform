-- Add match preference columns to hugo_love.dating_profiles
-- These columns enable matching based on gender, height, and ethnicity preferences

-- User's own attributes
ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS height_cm INTEGER;

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- User's seeking preferences
ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS seeking_genders TEXT[] DEFAULT '{}';

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS seeking_height_min INTEGER DEFAULT 150;

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS seeking_height_max INTEGER DEFAULT 200;

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS seeking_ethnicities TEXT[] DEFAULT '{}';

ALTER TABLE hugo_love.dating_profiles
ADD COLUMN IF NOT EXISTS seeking_interests TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN hugo_love.dating_profiles.gender IS 'User gender: Male, Female, Non-binary, Other';
COMMENT ON COLUMN hugo_love.dating_profiles.height_cm IS 'User height in centimeters';
COMMENT ON COLUMN hugo_love.dating_profiles.ethnicity IS 'User ethnicity';
COMMENT ON COLUMN hugo_love.dating_profiles.seeking_genders IS 'Genders the user is interested in: Men, Women, Non-binary, Everyone';
COMMENT ON COLUMN hugo_love.dating_profiles.seeking_height_min IS 'Minimum preferred height in cm';
COMMENT ON COLUMN hugo_love.dating_profiles.seeking_height_max IS 'Maximum preferred height in cm';
COMMENT ON COLUMN hugo_love.dating_profiles.seeking_ethnicities IS 'Ethnicities the user is interested in';
COMMENT ON COLUMN hugo_love.dating_profiles.seeking_interests IS 'Interests the user is looking for in matches';
