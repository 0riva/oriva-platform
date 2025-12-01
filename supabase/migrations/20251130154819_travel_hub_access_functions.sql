-- Create functions in oriva_platform schema to access travel_hub data
-- This bypasses the PostgREST schema exposure limitation

-- Function to get system_user by user_id
CREATE OR REPLACE FUNCTION oriva_platform.get_travel_hub_system_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  is_master_admin boolean,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = travel_hub, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.user_id,
    su.is_master_admin,
    su.is_active,
    su.created_at,
    su.updated_at
  FROM travel_hub.system_users su
  WHERE su.user_id = p_user_id;
END;
$$;

-- Function to get organization memberships with org details
CREATE OR REPLACE FUNCTION oriva_platform.get_travel_hub_memberships(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  role text,
  status text,
  joined_at timestamptz,
  org_id uuid,
  org_name text,
  org_slug text,
  org_status text,
  org_logo_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = travel_hub, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.id,
    om.role,
    om.status,
    om.joined_at,
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    o.status as org_status,
    o.logo_url as org_logo_url
  FROM travel_hub.organization_memberships om
  JOIN travel_hub.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p_user_id
    AND om.status = 'active';
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION oriva_platform.get_travel_hub_system_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION oriva_platform.get_travel_hub_memberships(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION oriva_platform.get_travel_hub_system_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION oriva_platform.get_travel_hub_memberships(uuid) TO service_role;
