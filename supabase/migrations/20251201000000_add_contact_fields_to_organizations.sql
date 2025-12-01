-- Add contact fields to organizations table
-- These fields are required by the admin API for organization management

ALTER TABLE travel_hub.organizations 
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN travel_hub.organizations.contact_email IS 'Primary contact email for the organization';
COMMENT ON COLUMN travel_hub.organizations.contact_phone IS 'Primary contact phone for the organization';
