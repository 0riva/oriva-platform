-- Travel Hub CRM Tables Migration
-- Adds Suppliers, Contacts, and Email Messaging system for Master Admin CRM functionality

-- ============================================================================
-- 1. SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE travel_hub.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'hotel', 'restaurant', 'transport_car', 'transport_jet',
        'transport_helicopter', 'flight', 'activity', 'cruise', 'tour',
        'dmc', 'wholesale', 'platform', 'channel_manager', 'hub_marketplace',
        'insurance', 'visa', 'other'
    )),

    -- Contact Info
    website TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    country TEXT,

    -- API Integration (for future API connections)
    api_provider TEXT,           -- e.g., 'amadeus', 'sabre', 'booking_com'
    api_config JSONB DEFAULT '{}',  -- API credentials/config (encrypted in app layer)
    api_enabled BOOLEAN DEFAULT FALSE,

    -- Status
    notes TEXT,
    is_preferred BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 2. CONTACTS TABLE
-- ============================================================================
CREATE TABLE travel_hub.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'white_label', 'ota', 'corporate', 'concierge', 'bank', 'insurance'
    )),
    market_level TEXT CHECK (market_level IN ('luxury', 'mass_market')),

    -- Contact Info
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    country TEXT,
    job_title TEXT,

    -- Status & Notes
    notes TEXT,
    utopia TEXT,        -- Vision/ideal state
    needs TEXT,         -- What they need
    offers TEXT,        -- What they offer
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 3. EMAIL TEMPLATES TABLE
-- ============================================================================
CREATE TABLE travel_hub.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Template variables (e.g., {{contact_name}}, {{company}})
    variables JSONB DEFAULT '[]',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 4. EMAIL CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE travel_hub.email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Targeting
    target_type TEXT NOT NULL CHECK (target_type IN ('individual', 'category', 'mixed')),
    target_categories TEXT[] DEFAULT '{}',
    target_market_levels TEXT[] DEFAULT '{}',
    target_contact_ids UUID[] DEFAULT '{}',

    -- Template reference (optional)
    template_id UUID REFERENCES travel_hub.email_templates(id),

    -- Campaign status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
    )),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,

    -- Stats (updated after sending)
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 5. EMAIL LOGS TABLE
-- ============================================================================
CREATE TABLE travel_hub.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    campaign_id UUID REFERENCES travel_hub.email_campaigns(id),
    contact_id UUID REFERENCES travel_hub.contacts(id),

    -- Email details
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,

    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'bounced', 'failed'
    )),
    error_message TEXT,

    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. TEST EMAIL LIST TABLE (for sending test emails before broadcast)
-- ============================================================================
CREATE TABLE travel_hub.test_email_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Suppliers
CREATE INDEX idx_suppliers_category ON travel_hub.suppliers(category);
CREATE INDEX idx_suppliers_country ON travel_hub.suppliers(country);
CREATE INDEX idx_suppliers_is_active ON travel_hub.suppliers(is_active);
CREATE INDEX idx_suppliers_is_preferred ON travel_hub.suppliers(is_preferred);
CREATE INDEX idx_suppliers_api_enabled ON travel_hub.suppliers(api_enabled);

-- Contacts
CREATE INDEX idx_contacts_category ON travel_hub.contacts(category);
CREATE INDEX idx_contacts_market_level ON travel_hub.contacts(market_level);
CREATE INDEX idx_contacts_company ON travel_hub.contacts(company);
CREATE INDEX idx_contacts_country ON travel_hub.contacts(country);
CREATE INDEX idx_contacts_is_active ON travel_hub.contacts(is_active);
CREATE INDEX idx_contacts_email ON travel_hub.contacts(email);

-- Email Templates
CREATE INDEX idx_email_templates_is_active ON travel_hub.email_templates(is_active);

-- Email Campaigns
CREATE INDEX idx_email_campaigns_status ON travel_hub.email_campaigns(status);
CREATE INDEX idx_email_campaigns_created_by ON travel_hub.email_campaigns(created_by);
CREATE INDEX idx_email_campaigns_scheduled_at ON travel_hub.email_campaigns(scheduled_at);
CREATE INDEX idx_email_campaigns_template_id ON travel_hub.email_campaigns(template_id);

-- Email Logs
CREATE INDEX idx_email_logs_campaign_id ON travel_hub.email_logs(campaign_id);
CREATE INDEX idx_email_logs_contact_id ON travel_hub.email_logs(contact_id);
CREATE INDEX idx_email_logs_status ON travel_hub.email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON travel_hub.email_logs(sent_at);

-- Test Email List
CREATE INDEX idx_test_email_list_is_active ON travel_hub.test_email_list(is_active);

-- ============================================================================
-- RLS POLICIES (Master Admin Only)
-- ============================================================================

-- Suppliers
ALTER TABLE travel_hub.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON travel_hub.suppliers
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "suppliers_insert" ON travel_hub.suppliers
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "suppliers_update" ON travel_hub.suppliers
    FOR UPDATE USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "suppliers_delete" ON travel_hub.suppliers
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.suppliers TO authenticated;

-- Contacts
ALTER TABLE travel_hub.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select" ON travel_hub.contacts
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "contacts_insert" ON travel_hub.contacts
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "contacts_update" ON travel_hub.contacts
    FOR UPDATE USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "contacts_delete" ON travel_hub.contacts
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.contacts TO authenticated;

-- Email Templates
ALTER TABLE travel_hub.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_select" ON travel_hub.email_templates
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_templates_insert" ON travel_hub.email_templates
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_templates_update" ON travel_hub.email_templates
    FOR UPDATE USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_templates_delete" ON travel_hub.email_templates
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.email_templates TO authenticated;

-- Email Campaigns
ALTER TABLE travel_hub.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_campaigns_select" ON travel_hub.email_campaigns
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_campaigns_insert" ON travel_hub.email_campaigns
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_campaigns_update" ON travel_hub.email_campaigns
    FOR UPDATE USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_campaigns_delete" ON travel_hub.email_campaigns
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.email_campaigns TO authenticated;

-- Email Logs (append-only)
ALTER TABLE travel_hub.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select" ON travel_hub.email_logs
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "email_logs_insert" ON travel_hub.email_logs
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT ON travel_hub.email_logs TO authenticated;

-- Test Email List
ALTER TABLE travel_hub.test_email_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_email_list_select" ON travel_hub.test_email_list
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "test_email_list_insert" ON travel_hub.test_email_list
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "test_email_list_update" ON travel_hub.test_email_list
    FOR UPDATE USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "test_email_list_delete" ON travel_hub.test_email_list
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.test_email_list TO authenticated;

-- ============================================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================================

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON travel_hub.suppliers
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON travel_hub.contacts
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON travel_hub.email_templates
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at
    BEFORE UPDATE ON travel_hub.email_campaigns
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE travel_hub.suppliers IS 'Supplier directory for Travel Hub CRM';
COMMENT ON TABLE travel_hub.contacts IS 'Contact directory for Travel Hub CRM (partners, OTAs, corporates, etc.)';
COMMENT ON TABLE travel_hub.email_templates IS 'Reusable email templates for CRM campaigns';
COMMENT ON TABLE travel_hub.email_campaigns IS 'Email campaigns/broadcasts to contacts';
COMMENT ON TABLE travel_hub.email_logs IS 'Individual email delivery logs';
COMMENT ON TABLE travel_hub.test_email_list IS 'Test recipients for previewing emails before broadcast';
