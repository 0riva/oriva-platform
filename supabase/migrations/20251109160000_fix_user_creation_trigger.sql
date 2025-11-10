DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    profile_username TEXT;
    counter INTEGER := 0;
    base_username TEXT;
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);

  base_username := COALESCE(
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
    'user'
  );

  IF char_length(base_username) < 3 THEN
    base_username := 'user';
  END IF;

  base_username := left(base_username, 27);

  profile_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = profile_username) LOOP
    counter := counter + 1;
    profile_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (
    account_id,
    display_name,
    username,
    is_default,
    is_active,
    is_anonymous
  )
  VALUES (
    NEW.id,
    'Anon',
    profile_username,
    true,
    true,
    true
  );

  INSERT INTO public.user_preferences (
    user_id,
    theme,
    language,
    timezone,
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
    'en',
    'UTC',
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
