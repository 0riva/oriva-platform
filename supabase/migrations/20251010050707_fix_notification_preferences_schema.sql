-- Fix create_default_notification_preferences function to use schema-qualified table name
-- This prevents "relation does not exist" errors when search_path isn't set correctly

CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, reminders_enabled, opportunities_enabled)
  VALUES (NEW.id, TRUE, TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
