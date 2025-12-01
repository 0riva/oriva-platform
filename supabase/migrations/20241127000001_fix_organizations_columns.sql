-- Fix: Add missing columns to travel_hub.organizations
-- This must run before the main schema migration creates indexes

-- Add is_active column if it doesn't exist
ALTER TABLE travel_hub.organizations
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add other potentially missing columns
ALTER TABLE travel_hub.organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE travel_hub.organizations
ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE travel_hub.organizations
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE travel_hub.organizations
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
