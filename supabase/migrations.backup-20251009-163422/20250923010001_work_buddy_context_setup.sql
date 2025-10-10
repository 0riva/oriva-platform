-- =====================================================
-- Work Buddy Context Setup Migration
-- Purpose: Configure Work Buddy as first 3rd party app context
-- Context: Oriva team acting as "3rd party developer"
-- =====================================================

-- =====================================================
-- WORK BUDDY SPECIFIC CONFIGURATION
-- =====================================================

-- Set up Work Buddy context settings
INSERT INTO context_settings (context, key, value, description, data_type, is_user_configurable) VALUES
-- Basic Work Buddy settings
('oo-work-buddy', 'max_appointments_per_day', '10', 'Maximum appointments a user can schedule per day', 'number', false),
('oo-work-buddy', 'default_meeting_duration', '30', 'Default meeting duration in minutes', 'number', true),
('oo-work-buddy', 'enable_team_scheduling', 'true', 'Allow team-based scheduling features', 'boolean', true),
('oo-work-buddy', 'working_hours_start', '"09:00"', 'Default working hours start time', 'string', true),
('oo-work-buddy', 'working_hours_end', '"17:00"', 'Default working hours end time', 'string', true),
('oo-work-buddy', 'timezone_support', 'true', 'Enable timezone-aware scheduling', 'boolean', false),
('oo-work-buddy', 'auto_sync_calendar', 'false', 'Automatically sync with external calendars', 'boolean', true),
('oo-work-buddy', 'reminder_notifications', 'true', 'Send reminder notifications for appointments', 'boolean', true),
('oo-work-buddy', 'productivity_tracking', 'true', 'Enable productivity metrics tracking', 'boolean', true),
('oo-work-buddy', 'collaboration_scoring', 'true', 'Enable collaboration score calculation', 'boolean', false);

-- =====================================================
-- WORK BUDDY KNOWLEDGE BASE SETUP
-- =====================================================

-- Insert initial Hugo AI coaching content for Work Buddy
INSERT INTO hugo_knowledge_base (context, category, input, output, confidence_score, tags, language) VALUES

-- Meeting efficiency coaching
('oo-work-buddy', 'coaching',
  '{"goal": "efficient meetings", "challenge": "meetings run too long"}',
  'Try 5-minute standups with clear agendas. Set a timer and stick to it. End with specific action items and owners.',
  0.95, ARRAY['meetings', 'efficiency', 'time-management'], 'en'),

('oo-work-buddy', 'coaching',
  '{"goal": "better team collaboration", "challenge": "remote team coordination"}',
  'Use async updates between sync meetings. Create shared documents for ongoing projects. Schedule regular but brief check-ins.',
  0.90, ARRAY['collaboration', 'remote-work', 'teamwork'], 'en'),

('oo-work-buddy', 'coaching',
  '{"goal": "productivity improvement", "challenge": "too many interruptions"}',
  'Block focus time in your calendar. Use status indicators to signal availability. Group similar tasks together.',
  0.85, ARRAY['productivity', 'focus', 'time-blocking'], 'en'),

-- Appointment scheduling tips
('oo-work-buddy', 'tips',
  '{"situation": "scheduling conflicts", "challenge": "overlapping meetings"}',
  'Leave 5-10 minute buffers between meetings. Use scheduling tools that show availability. Block travel time for in-person meetings.',
  0.88, ARRAY['scheduling', 'calendar', 'time-management'], 'en'),

('oo-work-buddy', 'tips',
  '{"situation": "team availability", "challenge": "finding common meeting times"}',
  'Use when2meet or similar tools for group scheduling. Consider rotating meeting times for global teams. Use async methods when possible.',
  0.82, ARRAY['scheduling', 'team-coordination', 'global-teams'], 'en'),

-- Productivity guidance
('oo-work-buddy', 'guidance',
  '{"goal": "work-life balance", "challenge": "working too many hours"}',
  'Set clear boundaries with calendar blocks. Use "focus time" and "available" signals. Practice saying no to non-essential meetings.',
  0.87, ARRAY['work-life-balance', 'boundaries', 'wellbeing'], 'en'),

('oo-work-buddy', 'guidance',
  '{"goal": "better communication", "challenge": "unclear expectations"}',
  'Use structured meeting agendas. Send pre-meeting briefs with objectives. Follow up with clear action items and deadlines.',
  0.91, ARRAY['communication', 'clarity', 'follow-up'], 'en'),

-- Onboarding content
('oo-work-buddy', 'onboarding',
  '{"step": "getting_started", "user_type": "new"}',
  'Welcome to Work Buddy! Start by setting your working hours and preferred meeting duration. We''ll help you optimize your schedule.',
  1.0, ARRAY['onboarding', 'setup', 'welcome'], 'en'),

('oo-work-buddy', 'onboarding',
  '{"step": "first_appointment", "user_type": "new"}',
  'Great job scheduling your first appointment! Try setting an agenda beforehand and blocking 5 minutes after for notes.',
  0.95, ARRAY['onboarding', 'first-use', 'best-practices'], 'en');

-- =====================================================
-- WORK BUDDY INTERACTION TYPES SETUP
-- =====================================================

-- Create a reference table for valid Work Buddy interaction types
CREATE TABLE IF NOT EXISTS work_buddy_interaction_types (
  type TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  data_schema JSONB, -- JSON schema for validating interaction data
  is_schedulable BOOLEAN DEFAULT false, -- Can this interaction be scheduled?
  default_duration INTEGER, -- Default duration in minutes
  requires_other_user BOOLEAN DEFAULT false -- Does this interaction require another user?
);

-- Insert Work Buddy specific interaction types
INSERT INTO work_buddy_interaction_types (type, description, data_schema, is_schedulable, default_duration, requires_other_user) VALUES

('appointment', 'One-on-one appointment with another user',
  '{"type": "object", "properties": {"title": {"type": "string"}, "agenda": {"type": "string"}, "location": {"type": "string"}, "meeting_type": {"enum": ["in-person", "video", "phone"]}, "preparation_notes": {"type": "string"}}}',
  true, 30, true),

('team_meeting', 'Group meeting with multiple participants',
  '{"type": "object", "properties": {"title": {"type": "string"}, "agenda": {"type": "string"}, "participants": {"type": "array", "items": {"type": "string"}}, "meeting_type": {"enum": ["in-person", "video", "hybrid"]}, "room": {"type": "string"}}}',
  true, 60, true),

('focus_block', 'Dedicated focus time for individual work',
  '{"type": "object", "properties": {"task": {"type": "string"}, "priority": {"enum": ["low", "medium", "high"]}, "project": {"type": "string"}, "notes": {"type": "string"}}}',
  true, 120, false),

('productivity_log', 'Log of completed tasks and productivity metrics',
  '{"type": "object", "properties": {"tasks_completed": {"type": "integer"}, "focus_rating": {"type": "integer", "minimum": 1, "maximum": 5}, "interruptions": {"type": "integer"}, "notes": {"type": "string"}, "mood": {"enum": ["low", "medium", "high"]}}}',
  false, null, false),

('collaboration_rating', 'Rate collaboration effectiveness with team members',
  '{"type": "object", "properties": {"collaboration_score": {"type": "integer", "minimum": 1, "maximum": 10}, "communication_quality": {"type": "integer", "minimum": 1, "maximum": 5}, "responsiveness": {"type": "integer", "minimum": 1, "maximum": 5}, "feedback": {"type": "string"}}}',
  false, null, true),

('break_reminder', 'Scheduled break or wellness reminder',
  '{"type": "object", "properties": {"break_type": {"enum": ["coffee", "lunch", "walk", "stretch", "meditation"]}, "duration": {"type": "integer"}, "location": {"type": "string"}}}',
  true, 15, false),

('status_update', 'Project or task status update',
  '{"type": "object", "properties": {"project": {"type": "string"}, "status": {"enum": ["on-track", "at-risk", "blocked", "completed"]}, "progress_percentage": {"type": "integer", "minimum": 0, "maximum": 100}, "blockers": {"type": "string"}, "next_steps": {"type": "string"}}}',
  false, null, false);

-- =====================================================
-- WORK BUDDY HELPER FUNCTIONS
-- =====================================================

-- Function to create a Work Buddy user profile
CREATE OR REPLACE FUNCTION create_work_buddy_profile(
  p_user_id UUID,
  p_bio TEXT DEFAULT NULL,
  p_working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00"}',
  p_collaboration_preferences JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  default_traits JSONB;
BEGIN
  -- Set default traits for Work Buddy context
  default_traits := jsonb_build_object(
    'punctuality', 0.8,
    'collaboration', 0.8,
    'communication', 0.8,
    'availability', 0.8,
    'responsiveness', 0.8
  );

  -- Create the context profile
  SELECT create_user_context(
    p_user_id,
    'oo-work-buddy',
    p_bio,
    default_traits,
    jsonb_build_object(
      'working_hours', p_working_hours,
      'collaboration_preferences', p_collaboration_preferences
    )
  ) INTO profile_id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to schedule a Work Buddy appointment
CREATE OR REPLACE FUNCTION schedule_work_buddy_appointment(
  p_user_id UUID,
  p_target_user_id UUID,
  p_appointment_data JSONB,
  p_scheduled_at TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
  appointment_id UUID;
BEGIN
  -- Log the appointment interaction
  SELECT log_context_interaction(
    p_user_id,
    'oo-work-buddy',
    'appointment',
    p_appointment_data,
    p_target_user_id,
    p_scheduled_at
  ) INTO appointment_id;

  -- Also create a corresponding interaction for the target user
  PERFORM log_context_interaction(
    p_target_user_id,
    'oo-work-buddy',
    'appointment',
    jsonb_build_object(
      'appointment_id', appointment_id,
      'initiator_user_id', p_user_id,
      'role', 'participant'
    ) || p_appointment_data,
    p_user_id,
    p_scheduled_at
  );

  RETURN appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update collaboration traits based on interactions
CREATE OR REPLACE FUNCTION update_collaboration_traits(
  p_user_id UUID,
  p_interaction_type TEXT,
  p_rating INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_traits JSONB;
  updated_traits JSONB;
BEGIN
  -- Get current traits
  SELECT traits INTO current_traits
  FROM user_contexts
  WHERE user_id = p_user_id AND context = 'oo-work-buddy';

  IF current_traits IS NULL THEN
    RETURN; -- No profile exists
  END IF;

  -- Update traits based on interaction type and rating
  updated_traits := current_traits;

  CASE p_interaction_type
    WHEN 'appointment' THEN
      -- Boost punctuality and communication traits
      updated_traits := jsonb_set(
        updated_traits,
        '{punctuality}',
        to_jsonb(LEAST(1.0, COALESCE((current_traits->>'punctuality')::FLOAT, 0.8) + 0.01))
      );
    WHEN 'collaboration_rating' THEN
      IF p_rating IS NOT NULL THEN
        -- Update collaboration trait based on received rating
        updated_traits := jsonb_set(
          updated_traits,
          '{collaboration}',
          to_jsonb(LEAST(1.0, (p_rating::FLOAT / 10.0) * 0.1 + COALESCE((current_traits->>'collaboration')::FLOAT, 0.8) * 0.9))
        );
      END IF;
    WHEN 'productivity_log' THEN
      -- Boost productivity-related traits
      updated_traits := jsonb_set(
        updated_traits,
        '{availability}',
        to_jsonb(LEAST(1.0, COALESCE((current_traits->>'availability')::FLOAT, 0.8) + 0.005))
      );
  END CASE;

  -- Update the user context
  UPDATE user_contexts
  SET traits = updated_traits, updated_at = NOW()
  WHERE user_id = p_user_id AND context = 'oo-work-buddy';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- WORK BUDDY VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for Work Buddy user dashboard
CREATE OR REPLACE VIEW work_buddy_user_dashboard AS
SELECT
  uc.user_id,
  uc.bio,
  uc.traits,
  uc.score,
  uc.preferences,
  COUNT(CASE WHEN ci.type = 'appointment' AND ci.scheduled_at >= NOW() THEN 1 END) as upcoming_appointments,
  COUNT(CASE WHEN ci.type = 'appointment' AND ci.scheduled_at < NOW() AND ci.status = 'completed' THEN 1 END) as completed_appointments,
  COUNT(CASE WHEN ci.type = 'productivity_log' AND ci.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as productivity_logs_week,
  AVG(CASE WHEN ci.type = 'productivity_log' AND ci.created_at >= NOW() - INTERVAL '30 days'
           THEN (ci.data->>'focus_rating')::INTEGER END) as avg_focus_rating_month,
  uc.updated_at as profile_updated_at
FROM user_contexts uc
LEFT JOIN context_interactions ci ON uc.user_id = ci.user_id AND ci.context = 'oo-work-buddy'
WHERE uc.context = 'oo-work-buddy' AND uc.is_active = true
GROUP BY uc.user_id, uc.bio, uc.traits, uc.score, uc.preferences, uc.updated_at;

-- View for Work Buddy appointments
CREATE OR REPLACE VIEW work_buddy_appointments AS
SELECT
  ci.id,
  ci.user_id,
  ci.target_user_id,
  ci.data,
  ci.scheduled_at,
  ci.status,
  ci.created_at,
  u1.email as user_email,
  u2.email as target_user_email,
  CASE WHEN ci.scheduled_at > NOW() THEN 'upcoming'
       WHEN ci.scheduled_at <= NOW() AND ci.status = 'completed' THEN 'completed'
       WHEN ci.scheduled_at <= NOW() AND ci.status != 'completed' THEN 'overdue'
       ELSE 'unknown' END as appointment_status
FROM context_interactions ci
LEFT JOIN auth.users u1 ON ci.user_id = u1.id
LEFT JOIN auth.users u2 ON ci.target_user_id = u2.id
WHERE ci.context = 'oo-work-buddy' AND ci.type = 'appointment'
ORDER BY ci.scheduled_at DESC;

-- =====================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- =====================================================

-- Note: Sample data creation is commented out to prevent issues with non-existent users
-- Uncomment and modify with real user IDs for testing in development

/*
-- Create sample Work Buddy profiles (replace with real user IDs)
SELECT create_work_buddy_profile(
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Project manager focused on team efficiency and clear communication',
  '{"start": "08:00", "end": "16:00"}'::JSONB,
  '{"meeting_style": "structured", "communication_preference": "direct"}'::JSONB
);

-- Create sample appointment
SELECT schedule_work_buddy_appointment(
  '00000000-0000-0000-0000-000000000001'::UUID,
  '00000000-0000-0000-0000-000000000002'::UUID,
  '{"title": "Weekly sync", "agenda": "Project updates and blockers", "meeting_type": "video"}'::JSONB,
  NOW() + INTERVAL '1 day'
);
*/

-- =====================================================
-- WORK BUDDY INTEGRATION POLICIES
-- =====================================================

-- Additional RLS policies specific to Work Buddy interactions (drop first to make idempotent)
DROP POLICY IF EXISTS "work_buddy_appointment_access" ON context_interactions;
CREATE POLICY "work_buddy_appointment_access" ON context_interactions
  FOR SELECT USING (
    context = 'oo-work-buddy' AND
    type = 'appointment' AND
    (auth.uid() = user_id OR auth.uid() = target_user_id) AND
    get_app_context() = 'oo-work-buddy'
  );

-- Policy for Work Buddy interaction types reference table (drop first to make idempotent)
ALTER TABLE work_buddy_interaction_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_buddy_types_read_only" ON work_buddy_interaction_types;
CREATE POLICY "work_buddy_types_read_only" ON work_buddy_interaction_types
  FOR SELECT USING (true); -- Public read access for interaction type definitions

-- =====================================================
-- COMMENTS AND NEXT STEPS
-- =====================================================

-- Comment: This migration sets up Work Buddy as the first 3rd party app context
-- Work Buddy is now completely isolated from Oriva Core data but shares the same infrastructure

-- Key Work Buddy Features Enabled:
-- 1. User profiles with collaboration traits
-- 2. Appointment scheduling system
-- 3. Productivity tracking and logging
-- 4. Hugo AI coaching for work efficiency
-- 5. Collaboration scoring and feedback

-- Next Steps:
-- 1. Create TypeScript types for Work Buddy data structures
-- 2. Build API endpoints for Work Buddy functionality
-- 3. Create React components for Work Buddy UI
-- 4. Implement Hugo AI integration for coaching
-- 5. Add calendar integration and notifications

-- Work Buddy is now ready to operate as a "3rd party app" within the Oriva ecosystem!