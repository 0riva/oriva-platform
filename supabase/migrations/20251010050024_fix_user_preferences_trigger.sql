-- Fix handle_new_user function to remove non-existent preferences column

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create default anonymous profile
  INSERT INTO public.profiles (
    account_id,
    display_name,
    is_default,
    is_active,
    is_anonymous
  )
  VALUES (
    NEW.id,
    'Anon',
    true,
    true,
    true
  );

  -- Create default user_preferences (removed non-existent preferences column)
  INSERT INTO public.user_preferences (
    user_id,
    theme,
    font_size,
    notifications_enabled,
    allow_direct_messages,
    profile_visibility,
    developer_mode,
    themecrumbs_enabled,
    themecrumbs_position,
    group_visibility_settings
  )
  VALUES (
    NEW.id,
    'auto',
    'medium',
    true,
    true,
    'public',
    false,
    true,
    'topic',
    '{}'::jsonb
  );

  RETURN NEW;
END;
$$;
