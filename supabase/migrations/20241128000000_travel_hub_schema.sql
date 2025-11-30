-- Travel Hub / Merlin Concierge Schema
-- B2B luxury travel concierge platform with multi-tenant RBAC

-- Create schema
CREATE SCHEMA IF NOT EXISTS travel_hub;

-- ============================================
-- CORE TABLES
-- ============================================

-- Organizations table (travel agencies, tour operators)
CREATE TABLE IF NOT EXISTS travel_hub.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    website TEXT,
    description TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System users table (links auth.users to platform roles)
CREATE TABLE IF NOT EXISTS travel_hub.system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_master_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Organization memberships (users can belong to multiple orgs)
CREATE TABLE IF NOT EXISTS travel_hub.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES travel_hub.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('org_admin', 'concierge_agent', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Invitations for org members
CREATE TABLE IF NOT EXISTS travel_hub.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES travel_hub.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('org_admin', 'concierge_agent', 'viewer')),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONCIERGE TABLES
-- ============================================

-- Concierge profiles
CREATE TABLE IF NOT EXISTS travel_hub.concierges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES travel_hub.organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    bio TEXT,
    specializations TEXT[] DEFAULT '{}',
    languages TEXT[] DEFAULT '{}',
    certifications TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'away', 'offline')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Travel clients (people who book travel)
CREATE TABLE IF NOT EXISTS travel_hub.travel_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    travel_style TEXT,
    budget_range TEXT,
    passport_country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Concierge-client relationships
CREATE TABLE IF NOT EXISTS travel_hub.concierge_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concierge_id UUID NOT NULL REFERENCES travel_hub.concierges(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES travel_hub.travel_clients(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    notes TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(concierge_id, client_id)
);

-- ============================================
-- CHAT / MESSAGING TABLES
-- ============================================

-- Conversations between concierges and clients
CREATE TABLE IF NOT EXISTS travel_hub.concierge_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concierge_id UUID NOT NULL REFERENCES travel_hub.concierges(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES travel_hub.travel_clients(id) ON DELETE CASCADE,
    subject TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    last_message_at TIMESTAMPTZ,
    unread_count_concierge INTEGER DEFAULT 0,
    unread_count_client INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages in conversations
CREATE TABLE IF NOT EXISTS travel_hub.concierge_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES travel_hub.concierge_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('concierge', 'client', 'system')),
    sender_id UUID,
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ITINERARY TABLES
-- ============================================

-- Travel itineraries
CREATE TABLE IF NOT EXISTS travel_hub.travel_itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES travel_hub.travel_clients(id) ON DELETE CASCADE,
    concierge_id UUID REFERENCES travel_hub.concierges(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    destination TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    total_cost DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',
    cover_image_url TEXT,
    settings JSONB DEFAULT '{}',
    share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itinerary items (activities, hotels, flights, etc.)
CREATE TABLE IF NOT EXISTS travel_hub.itinerary_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id UUID NOT NULL REFERENCES travel_hub.travel_itineraries(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('flight', 'hotel', 'activity', 'transport', 'meal', 'note', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    location_coords JSONB,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    day_number INTEGER,
    sort_order INTEGER DEFAULT 0,
    cost DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    booking_reference TEXT,
    booking_status TEXT DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled')),
    vendor_name TEXT,
    vendor_contact TEXT,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS travel_hub.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES travel_hub.organizations(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON travel_hub.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON travel_hub.organizations(is_active);

-- System users
CREATE INDEX IF NOT EXISTS idx_system_users_user_id ON travel_hub.system_users(user_id);

-- Memberships
CREATE INDEX IF NOT EXISTS idx_memberships_user ON travel_hub.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON travel_hub.organization_memberships(organization_id);

-- Invitations
CREATE INDEX IF NOT EXISTS idx_invitations_org ON travel_hub.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON travel_hub.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON travel_hub.invitations(token);

-- Concierges
CREATE INDEX IF NOT EXISTS idx_concierges_user ON travel_hub.concierges(user_id);
CREATE INDEX IF NOT EXISTS idx_concierges_org ON travel_hub.concierges(organization_id);
CREATE INDEX IF NOT EXISTS idx_concierges_featured ON travel_hub.concierges(is_featured);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_user ON travel_hub.travel_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON travel_hub.travel_clients(email);

-- Concierge-client relationships
CREATE INDEX IF NOT EXISTS idx_cc_concierge ON travel_hub.concierge_clients(concierge_id);
CREATE INDEX IF NOT EXISTS idx_cc_client ON travel_hub.concierge_clients(client_id);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conv_concierge ON travel_hub.concierge_conversations(concierge_id);
CREATE INDEX IF NOT EXISTS idx_conv_client ON travel_hub.concierge_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conv_last_message ON travel_hub.concierge_conversations(last_message_at DESC);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conv ON travel_hub.concierge_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON travel_hub.concierge_messages(created_at DESC);

-- Itineraries
CREATE INDEX IF NOT EXISTS idx_itin_client ON travel_hub.travel_itineraries(client_id);
CREATE INDEX IF NOT EXISTS idx_itin_concierge ON travel_hub.travel_itineraries(concierge_id);
CREATE INDEX IF NOT EXISTS idx_itin_share_token ON travel_hub.travel_itineraries(share_token);
CREATE INDEX IF NOT EXISTS idx_itin_dates ON travel_hub.travel_itineraries(start_date, end_date);

-- Itinerary items
CREATE INDEX IF NOT EXISTS idx_items_itinerary ON travel_hub.itinerary_items(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_items_day ON travel_hub.itinerary_items(itinerary_id, day_number);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_user ON travel_hub.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON travel_hub.audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON travel_hub.audit_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE travel_hub.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.concierges ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.travel_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.concierge_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.concierge_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.concierge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.travel_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_hub.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is master admin
CREATE OR REPLACE FUNCTION travel_hub.is_master_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM travel_hub.system_users
        WHERE user_id = user_uuid AND is_master_admin = true AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is org admin for an organization
CREATE OR REPLACE FUNCTION travel_hub.is_org_admin(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM travel_hub.organization_memberships
        WHERE user_id = user_uuid
        AND organization_id = org_uuid
        AND role = 'org_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user has any membership in org
CREATE OR REPLACE FUNCTION travel_hub.is_org_member(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM travel_hub.organization_memberships
        WHERE user_id = user_uuid
        AND organization_id = org_uuid
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations: Master admins can see all, members see their orgs
CREATE POLICY "organizations_select" ON travel_hub.organizations
    FOR SELECT USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_member(auth.uid(), id)
    );

CREATE POLICY "organizations_insert" ON travel_hub.organizations
    FOR INSERT WITH CHECK (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "organizations_update" ON travel_hub.organizations
    FOR UPDATE USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), id)
    );

CREATE POLICY "organizations_delete" ON travel_hub.organizations
    FOR DELETE USING (travel_hub.is_master_admin(auth.uid()));

-- System users: Only master admins can manage
CREATE POLICY "system_users_all" ON travel_hub.system_users
    FOR ALL USING (travel_hub.is_master_admin(auth.uid()));

-- Organization memberships: Org admins can manage their org
CREATE POLICY "memberships_select" ON travel_hub.organization_memberships
    FOR SELECT USING (
        travel_hub.is_master_admin(auth.uid())
        OR user_id = auth.uid()
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

CREATE POLICY "memberships_insert" ON travel_hub.organization_memberships
    FOR INSERT WITH CHECK (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

CREATE POLICY "memberships_update" ON travel_hub.organization_memberships
    FOR UPDATE USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

CREATE POLICY "memberships_delete" ON travel_hub.organization_memberships
    FOR DELETE USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

-- Invitations: Org admins can manage invitations for their org
CREATE POLICY "invitations_select" ON travel_hub.invitations
    FOR SELECT USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

CREATE POLICY "invitations_insert" ON travel_hub.invitations
    FOR INSERT WITH CHECK (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

CREATE POLICY "invitations_delete" ON travel_hub.invitations
    FOR DELETE USING (
        travel_hub.is_master_admin(auth.uid())
        OR travel_hub.is_org_admin(auth.uid(), organization_id)
    );

-- Concierges: Public read for featured, own profile management
CREATE POLICY "concierges_select" ON travel_hub.concierges
    FOR SELECT USING (
        is_featured = true
        OR user_id = auth.uid()
        OR travel_hub.is_master_admin(auth.uid())
        OR (organization_id IS NOT NULL AND travel_hub.is_org_member(auth.uid(), organization_id))
    );

CREATE POLICY "concierges_insert" ON travel_hub.concierges
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "concierges_update" ON travel_hub.concierges
    FOR UPDATE USING (
        user_id = auth.uid()
        OR travel_hub.is_master_admin(auth.uid())
        OR (organization_id IS NOT NULL AND travel_hub.is_org_admin(auth.uid(), organization_id))
    );

-- Travel clients: Concierges see their clients
CREATE POLICY "clients_select" ON travel_hub.travel_clients
    FOR SELECT USING (
        user_id = auth.uid()
        OR travel_hub.is_master_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM travel_hub.concierge_clients cc
            JOIN travel_hub.concierges c ON cc.concierge_id = c.id
            WHERE cc.client_id = travel_hub.travel_clients.id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "clients_insert" ON travel_hub.travel_clients
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR user_id IS NULL -- Allow creating clients without user accounts
    );

CREATE POLICY "clients_update" ON travel_hub.travel_clients
    FOR UPDATE USING (
        user_id = auth.uid()
        OR travel_hub.is_master_admin(auth.uid())
    );

-- Concierge-client relationships
CREATE POLICY "cc_select" ON travel_hub.concierge_clients
    FOR SELECT USING (
        travel_hub.is_master_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "cc_insert" ON travel_hub.concierge_clients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        )
    );

-- Conversations: Participants can see their conversations
CREATE POLICY "conversations_select" ON travel_hub.concierge_conversations
    FOR SELECT USING (
        travel_hub.is_master_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM travel_hub.travel_clients tc
            WHERE tc.id = client_id AND tc.user_id = auth.uid()
        )
    );

CREATE POLICY "conversations_insert" ON travel_hub.concierge_conversations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM travel_hub.travel_clients tc
            WHERE tc.id = client_id AND tc.user_id = auth.uid()
        )
    );

-- Messages: Conversation participants
CREATE POLICY "messages_select" ON travel_hub.concierge_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM travel_hub.concierge_conversations conv
            WHERE conv.id = conversation_id
            AND (
                EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = conv.concierge_id AND c.user_id = auth.uid())
                OR EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = conv.client_id AND tc.user_id = auth.uid())
            )
        )
    );

CREATE POLICY "messages_insert" ON travel_hub.concierge_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM travel_hub.concierge_conversations conv
            WHERE conv.id = conversation_id
            AND (
                (sender_type = 'concierge' AND EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = conv.concierge_id AND c.user_id = auth.uid()))
                OR (sender_type = 'client' AND EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = conv.client_id AND tc.user_id = auth.uid()))
            )
        )
    );

-- Itineraries: Client and concierge access
CREATE POLICY "itineraries_select" ON travel_hub.travel_itineraries
    FOR SELECT USING (
        is_public = true
        OR travel_hub.is_master_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM travel_hub.travel_clients tc
            WHERE tc.id = client_id AND tc.user_id = auth.uid()
        )
        OR (concierge_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        ))
    );

CREATE POLICY "itineraries_insert" ON travel_hub.travel_itineraries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM travel_hub.travel_clients tc
            WHERE tc.id = client_id AND tc.user_id = auth.uid()
        )
        OR (concierge_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        ))
    );

CREATE POLICY "itineraries_update" ON travel_hub.travel_itineraries
    FOR UPDATE USING (
        travel_hub.is_master_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM travel_hub.travel_clients tc
            WHERE tc.id = client_id AND tc.user_id = auth.uid()
        )
        OR (concierge_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM travel_hub.concierges c
            WHERE c.id = concierge_id AND c.user_id = auth.uid()
        ))
    );

-- Itinerary items: Follow itinerary access
CREATE POLICY "items_select" ON travel_hub.itinerary_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM travel_hub.travel_itineraries i
            WHERE i.id = itinerary_id
            AND (
                i.is_public = true
                OR travel_hub.is_master_admin(auth.uid())
                OR EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = i.client_id AND tc.user_id = auth.uid())
                OR (i.concierge_id IS NOT NULL AND EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = i.concierge_id AND c.user_id = auth.uid()))
            )
        )
    );

CREATE POLICY "items_insert" ON travel_hub.itinerary_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM travel_hub.travel_itineraries i
            WHERE i.id = itinerary_id
            AND (
                EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = i.client_id AND tc.user_id = auth.uid())
                OR (i.concierge_id IS NOT NULL AND EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = i.concierge_id AND c.user_id = auth.uid()))
            )
        )
    );

CREATE POLICY "items_update" ON travel_hub.itinerary_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM travel_hub.travel_itineraries i
            WHERE i.id = itinerary_id
            AND (
                travel_hub.is_master_admin(auth.uid())
                OR EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = i.client_id AND tc.user_id = auth.uid())
                OR (i.concierge_id IS NOT NULL AND EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = i.concierge_id AND c.user_id = auth.uid()))
            )
        )
    );

CREATE POLICY "items_delete" ON travel_hub.itinerary_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM travel_hub.travel_itineraries i
            WHERE i.id = itinerary_id
            AND (
                travel_hub.is_master_admin(auth.uid())
                OR EXISTS (SELECT 1 FROM travel_hub.travel_clients tc WHERE tc.id = i.client_id AND tc.user_id = auth.uid())
                OR (i.concierge_id IS NOT NULL AND EXISTS (SELECT 1 FROM travel_hub.concierges c WHERE c.id = i.concierge_id AND c.user_id = auth.uid()))
            )
        )
    );

-- Audit log: Only master admins
CREATE POLICY "audit_select" ON travel_hub.audit_log
    FOR SELECT USING (travel_hub.is_master_admin(auth.uid()));

CREATE POLICY "audit_insert" ON travel_hub.audit_log
    FOR INSERT WITH CHECK (true); -- Allow system to insert audit logs

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION travel_hub.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON travel_hub.organizations
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_system_users_updated_at
    BEFORE UPDATE ON travel_hub.system_users
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON travel_hub.organization_memberships
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_concierges_updated_at
    BEFORE UPDATE ON travel_hub.concierges
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON travel_hub.travel_clients
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_cc_updated_at
    BEFORE UPDATE ON travel_hub.concierge_clients
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON travel_hub.concierge_conversations
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_itineraries_updated_at
    BEFORE UPDATE ON travel_hub.travel_itineraries
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON travel_hub.itinerary_items
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_updated_at();

-- Message notification trigger (updates conversation last_message_at)
CREATE OR REPLACE FUNCTION travel_hub.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE travel_hub.concierge_conversations
    SET
        last_message_at = NEW.created_at,
        unread_count_concierge = CASE WHEN NEW.sender_type = 'client' THEN unread_count_concierge + 1 ELSE unread_count_concierge END,
        unread_count_client = CASE WHEN NEW.sender_type = 'concierge' THEN unread_count_client + 1 ELSE unread_count_client END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_inserted
    AFTER INSERT ON travel_hub.concierge_messages
    FOR EACH ROW EXECUTE FUNCTION travel_hub.update_conversation_on_message();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA travel_hub TO authenticated;
GRANT USAGE ON SCHEMA travel_hub TO anon;

-- Grant select on all tables to authenticated users (RLS handles fine-grained access)
GRANT SELECT ON ALL TABLES IN SCHEMA travel_hub TO authenticated;
GRANT INSERT ON ALL TABLES IN SCHEMA travel_hub TO authenticated;
GRANT UPDATE ON ALL TABLES IN SCHEMA travel_hub TO authenticated;
GRANT DELETE ON ALL TABLES IN SCHEMA travel_hub TO authenticated;

-- Grant limited access to anon for public data (like shared itineraries)
GRANT SELECT ON travel_hub.travel_itineraries TO anon;
GRANT SELECT ON travel_hub.itinerary_items TO anon;
GRANT SELECT ON travel_hub.concierges TO anon;
