-- Add AI Coaching Columns to existing User Preferences table
-- Adds current_goals, core_values, and work_style columns for Hugo memory extraction

-- Add columns if they don't already exist
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS current_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS core_values TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS work_style VARCHAR(50) DEFAULT 'collaborative' CHECK (work_style IN ('collaborative', 'independent', 'balanced', 'mixed'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_hugo_coaching 
ON public.user_preferences(user_id, work_style);
