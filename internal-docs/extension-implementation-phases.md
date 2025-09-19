# 🚀 Extension Implementation - Phased Step-by-Step Plan

> **Detailed implementation plan for adding Extension profile and group visibility to the existing Oriva Platform API**

## 📋 **Overview**

This plan builds incrementally on the existing API codebase without disrupting current functionality. Each phase is self-contained and can be deployed independently.

---

## 🎯 **Phase 1: Database Foundation (Week 1)**

### **Step 1.1: Create Extension Database Tables**
```sql
-- Add to existing Supabase database
-- File: migrations/001_extension_tables.sql

-- Extension profile permissions (profiles managed in Oriva Core)
CREATE TABLE extension_profile_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_profile_id VARCHAR(255) NOT NULL, -- Profile ID from Oriva Core
  profile_name VARCHAR(255) NOT NULL, -- "Dating Profile", "Work Profile", "Anon Profile"
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_profile_id)
);

-- Extension active profile sessions
CREATE TABLE extension_active_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_oriva_profile_id VARCHAR(255) NOT NULL, -- Currently active profile
  session_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(extension_id, user_id)
);

-- Extension group permissions (groups managed in Oriva Core)
CREATE TABLE extension_group_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_group_id VARCHAR(255) NOT NULL, -- Group ID from Oriva Core
  group_name VARCHAR(255) NOT NULL, -- Group name from Oriva Core
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_group_id)
);

-- Real-time update subscriptions
CREATE TABLE extension_realtime_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_type VARCHAR(100) NOT NULL, -- "profile_updates", "group_updates", "group_membership"
  oriva_resource_id VARCHAR(255) NOT NULL, -- Profile ID or Group ID from Oriva Core
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, subscription_type, oriva_resource_id)
);

-- Indexes for performance
CREATE INDEX idx_extension_profile_permissions_extension_id ON extension_profile_permissions(extension_id);
CREATE INDEX idx_extension_profile_permissions_user_id ON extension_profile_permissions(user_id);
CREATE INDEX idx_extension_active_profiles_extension_id ON extension_active_profiles(extension_id);
CREATE INDEX idx_extension_group_permissions_extension_id ON extension_group_permissions(extension_id);
CREATE INDEX idx_extension_realtime_subscriptions_extension_id ON extension_realtime_subscriptions(extension_id);

-- Row Level Security
ALTER TABLE extension_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_active_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_realtime_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies (service role can manage all)
CREATE POLICY "Service role can manage extension_profile_permissions" ON extension_profile_permissions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage extension_active_profiles" ON extension_active_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage extension_group_permissions" ON extension_group_permissions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage extension_realtime_subscriptions" ON extension_realtime_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
```

### **Step 1.2: Add Environment Variables**
```bash
# Add to .env file
ORIVA_CORE_API_URL=https://api.oriva.io/core
ORIVA_CORE_SERVICE_TOKEN=your_service_token_here
```

### **Step 1.3: Test Database Setup**
```bash
# Run migration
psql -h your-supabase-host -U postgres -d postgres -f migrations/001_extension_tables.sql

# Verify tables created
psql -h your-supabase-host -U postgres -d postgres -c "\dt extension_*"
```

---

## 🎯 **Phase 2: Core Middleware (Week 2)**

### **Step 2.1: Add Oriva Core Integration Helper**
```javascript
// Add to api/index.js after existing middleware

// Oriva Core API integration
const ORIVA_CORE_API_URL = process.env.ORIVA_CORE_API_URL;
const ORIVA_CORE_SERVICE_TOKEN = process.env.ORIVA_CORE_SERVICE_TOKEN;

// Helper function to call Oriva Core API
const callOrivaCoreAPI = async (endpoint, method = 'GET', data = null) => {
  try {
    const response = await fetch(`${ORIVA_CORE_API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${ORIVA_CORE_SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      throw new Error(`Oriva Core API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Oriva Core API call failed:', error);
    throw error;
  }
};
```

### **Step 2.2: Add Extension Permission Validation Middleware**
```javascript
// Add to api/index.js after existing middleware

// Extension profile access validation
const validateExtensionProfileAccess = async (req, res, next) => {
  const { orivaProfileId } = req.params;
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  try {
    const { data: permission, error } = await supabase
      .from('extension_profile_permissions')
      .select('*')
      .eq('extension_id', extensionId)
      .eq('oriva_profile_id', orivaProfileId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !permission) {
      return res.status(403).json({
        success: false,
        error: 'Extension does not have access to this profile'
      });
    }

    req.extensionProfilePermission = permission;
    next();
  } catch (error) {
    console.error('Extension profile access validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate profile access'
    });
  }
};

// Extension group access validation
const validateExtensionGroupAccess = async (req, res, next) => {
  const { orivaGroupId } = req.params;
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  try {
    const { data: permission, error } = await supabase
      .from('extension_group_permissions')
      .select('*')
      .eq('extension_id', extensionId)
      .eq('oriva_group_id', orivaGroupId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !permission) {
      return res.status(403).json({
        success: false,
        error: 'Extension does not have access to this group'
      });
    }

    req.extensionGroupPermission = permission;
    next();
  } catch (error) {
    console.error('Extension group access validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate group access'
    });
  }
};
```

### **Step 2.3: Add Data Sanitization Functions**
```javascript
// Add to api/index.js after existing middleware

// Generate public IDs (never expose real Oriva Core IDs)
const generatePublicId = (realId) => {
  const hash = crypto.createHash('sha256').update(realId).digest('hex');
  return `ext_${hash.substring(0, 16)}`;
};

// Profile data sanitization for Extensions
const sanitizeProfileDataForExtension = (profile) => {
  return {
    profileId: generatePublicId(profile.orivaProfileId),
    profileName: profile.profileName,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    location: profile.location,
    website: profile.website,
    customFields: profile.customFields,
    // NEVER include: user_id, oriva_profile_id, internal Oriva Core IDs
  };
};

// Group data sanitization for Extensions
const sanitizeGroupDataForExtension = (group) => {
  return {
    groupId: generatePublicId(group.orivaGroupId),
    groupName: group.groupName,
    groupType: group.groupType,
    memberCount: group.memberCount,
    userRole: group.userRole,
    joinedAt: group.joinedAt,
    // NEVER include: description, created_by, internal Oriva Core IDs
  };
};

// Group member data sanitization
const sanitizeGroupMemberData = (member) => {
  return {
    memberId: generatePublicId(member.userId),
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    role: member.role,
    joinedAt: member.joinedAt,
    // NEVER include: user_id, email, full profile details
  };
};
```

### **Step 2.4: Test Middleware**
```bash
# Test the new middleware functions
node -e "
const { validateExtensionProfileAccess, sanitizeProfileDataForExtension } = require('./api/index.js');
console.log('✅ Middleware functions loaded successfully');
"
```

---

## 🎯 **Phase 3: Profile Endpoints (Week 3)**

### **Step 3.1: Add Profile Management Endpoints**
```javascript
// Add to api/index.js after existing endpoints

// =============================================================================
// EXTENSION PROFILE ENDPOINTS
// =============================================================================

// Get available profiles for Extension
app.get('/api/v1/profiles/available', validateApiKey, async (req, res) => {
  try {
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    // Get authorized profiles for this Extension
    const { data: permissions, error } = await supabase
      .from('extension_profile_permissions')
      .select('oriva_profile_id, profile_name')
      .eq('extension_id', extensionId)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch profile permissions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch available profiles'
      });
    }

    // Fetch profile data from Oriva Core for each authorized profile
    const profiles = [];
    for (const permission of permissions) {
      try {
        const profileData = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${permission.oriva_profile_id}`);
        profiles.push(sanitizeProfileDataForExtension(profileData));
      } catch (error) {
        console.warn(`Failed to fetch profile ${permission.oriva_profile_id}:`, error);
        // Continue with other profiles
      }
    }

    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error('Available profiles endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current active profile for Extension
app.get('/api/v1/profiles/current', validateApiKey, async (req, res) => {
  try {
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    // Check for active profile session
    const { data: activeSession, error: sessionError } = await supabase
      .from('extension_active_profiles')
      .select('active_oriva_profile_id')
      .eq('extension_id', extensionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !activeSession?.active_oriva_profile_id) {
      // Return default profile (Anon profile)
      try {
        const defaultProfile = await callOrivaCoreAPI(`/api/core/profiles/${userId}/default`);
        return res.json({
          success: true,
          data: {
            activeProfile: sanitizeProfileDataForExtension(defaultProfile),
            isDefault: true,
            profileName: 'Anon Profile'
          }
        });
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'No active profile found'
        });
      }
    }

    // Fetch current active profile from Oriva Core
    const profileData = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${activeSession.active_oriva_profile_id}`);
    
    res.json({
      success: true,
      data: {
        activeProfile: sanitizeProfileDataForExtension(profileData),
        isDefault: false
      }
    });
  } catch (error) {
    console.error('Current profile endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Switch to specific profile
app.post('/api/v1/profiles/:orivaProfileId/activate', validateApiKey, validateExtensionProfileAccess, async (req, res) => {
  try {
    const { orivaProfileId } = req.params;
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    // Update active profile in Extension session
    const { error: updateError } = await supabase
      .from('extension_active_profiles')
      .upsert({
        extension_id: extensionId,
        user_id: userId,
        active_oriva_profile_id: orivaProfileId,
        last_accessed_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Failed to update active profile:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to switch profile'
      });
    }

    // Fetch profile data from Oriva Core
    const profileData = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${orivaProfileId}`);

    // Get available profiles for response
    const { data: permissions } = await supabase
      .from('extension_profile_permissions')
      .select('oriva_profile_id, profile_name')
      .eq('extension_id', extensionId)
      .eq('user_id', userId)
      .eq('is_active', true);

    const availableProfiles = [];
    for (const permission of permissions) {
      try {
        const profile = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${permission.oriva_profile_id}`);
        availableProfiles.push(sanitizeProfileDataForExtension(profile));
      } catch (error) {
        console.warn(`Failed to fetch profile ${permission.oriva_profile_id}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        activeProfile: sanitizeProfileDataForExtension(profileData),
        availableProfiles: availableProfiles,
        profileSwitched: true
      }
    });
  } catch (error) {
    console.error('Profile activation endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific profile data (if authorized)
app.get('/api/v1/profiles/:orivaProfileId', validateApiKey, validateExtensionProfileAccess, async (req, res) => {
  try {
    const { orivaProfileId } = req.params;
    const userId = req.keyInfo.userId;

    // Fetch profile data from Oriva Core
    const profileData = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${orivaProfileId}`);

    res.json({
      success: true,
      data: sanitizeProfileDataForExtension(profileData)
    });
  } catch (error) {
    console.error('Profile detail endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update profile data (if authorized)
app.put('/api/v1/profiles/:orivaProfileId', validateApiKey, validateExtensionProfileAccess, async (req, res) => {
  try {
    const { orivaProfileId } = req.params;
    const userId = req.keyInfo.userId;
    const updateData = req.body;

    // Update profile in Oriva Core
    const updatedProfile = await callOrivaCoreAPI(`/api/core/profiles/${userId}/${orivaProfileId}`, 'PUT', updateData);

    res.json({
      success: true,
      data: sanitizeProfileDataForExtension(updatedProfile)
    });
  } catch (error) {
    console.error('Profile update endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### **Step 3.2: Test Profile Endpoints**
```bash
# Test profile endpoints
curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  http://localhost:3001/api/v1/profiles/available

curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  http://localhost:3001/api/v1/profiles/current
```

---

## 🎯 **Phase 4: Group Endpoints (Week 4)**

### **Step 4.1: Add Group Management Endpoints**
```javascript
// Add to api/index.js after profile endpoints

// =============================================================================
// EXTENSION GROUP ENDPOINTS
// =============================================================================

// Get available groups for Extension
app.get('/api/v1/groups', validateApiKey, async (req, res) => {
  try {
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    // Get authorized groups for this Extension
    const { data: permissions, error } = await supabase
      .from('extension_group_permissions')
      .select('oriva_group_id, group_name')
      .eq('extension_id', extensionId)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch group permissions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch available groups'
      });
    }

    // Fetch group data from Oriva Core for each authorized group
    const groups = [];
    for (const permission of permissions) {
      try {
        const groupData = await callOrivaCoreAPI(`/api/core/groups/${userId}/${permission.oriva_group_id}`);
        groups.push(sanitizeGroupDataForExtension(groupData));
      } catch (error) {
        console.warn(`Failed to fetch group ${permission.oriva_group_id}:`, error);
        // Continue with other groups
      }
    }

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Available groups endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific group data (if authorized)
app.get('/api/v1/groups/:orivaGroupId', validateApiKey, validateExtensionGroupAccess, async (req, res) => {
  try {
    const { orivaGroupId } = req.params;
    const userId = req.keyInfo.userId;

    // Fetch group data from Oriva Core
    const groupData = await callOrivaCoreAPI(`/api/core/groups/${userId}/${orivaGroupId}`);

    res.json({
      success: true,
      data: sanitizeGroupDataForExtension(groupData)
    });
  } catch (error) {
    console.error('Group detail endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get group members (if authorized)
app.get('/api/v1/groups/:orivaGroupId/members', validateApiKey, validateExtensionGroupAccess, async (req, res) => {
  try {
    const { orivaGroupId } = req.params;
    const userId = req.keyInfo.userId;

    // Fetch group members from Oriva Core
    const membersData = await callOrivaCoreAPI(`/api/core/groups/${userId}/${orivaGroupId}/members`);

    // Sanitize member data
    const sanitizedMembers = membersData.map(member => sanitizeGroupMemberData(member));

    res.json({
      success: true,
      data: sanitizedMembers
    });
  } catch (error) {
    console.error('Group members endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### **Step 4.2: Test Group Endpoints**
```bash
# Test group endpoints
curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  http://localhost:3001/api/v1/groups

curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  http://localhost:3001/api/v1/groups/group_123
```

---

## 🎯 **Phase 5: Real-time Subscriptions (Week 5)**

### **Step 5.1: Add Subscription Endpoints**
```javascript
// Add to api/index.js after group endpoints

// =============================================================================
// EXTENSION REAL-TIME SUBSCRIPTIONS
// =============================================================================

// Subscribe to profile updates
app.post('/api/v1/subscriptions/profiles', validateApiKey, async (req, res) => {
  try {
    const { orivaProfileId } = req.body;
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    if (!orivaProfileId) {
      return res.status(400).json({
        success: false,
        error: 'orivaProfileId is required'
      });
    }

    // Verify Extension has access to this profile
    const { data: permission, error: permError } = await supabase
      .from('extension_profile_permissions')
      .select('*')
      .eq('extension_id', extensionId)
      .eq('oriva_profile_id', orivaProfileId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (permError || !permission) {
      return res.status(403).json({
        success: false,
        error: 'Extension does not have access to this profile'
      });
    }

    // Create subscription
    const { data: subscription, error } = await supabase
      .from('extension_realtime_subscriptions')
      .upsert({
        extension_id: extensionId,
        user_id: userId,
        subscription_type: 'profile_updates',
        oriva_resource_id: orivaProfileId,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create profile subscription:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create subscription'
      });
    }

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        subscriptionType: 'profile_updates',
        resourceId: orivaProfileId
      }
    });
  } catch (error) {
    console.error('Profile subscription endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Subscribe to group updates
app.post('/api/v1/subscriptions/groups', validateApiKey, async (req, res) => {
  try {
    const { orivaGroupId } = req.body;
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    if (!orivaGroupId) {
      return res.status(400).json({
        success: false,
        error: 'orivaGroupId is required'
      });
    }

    // Verify Extension has access to this group
    const { data: permission, error: permError } = await supabase
      .from('extension_group_permissions')
      .select('*')
      .eq('extension_id', extensionId)
      .eq('oriva_group_id', orivaGroupId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (permError || !permission) {
      return res.status(403).json({
        success: false,
        error: 'Extension does not have access to this group'
      });
    }

    // Create subscription
    const { data: subscription, error } = await supabase
      .from('extension_realtime_subscriptions')
      .upsert({
        extension_id: extensionId,
        user_id: userId,
        subscription_type: 'group_updates',
        oriva_resource_id: orivaGroupId,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create group subscription:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create subscription'
      });
    }

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        subscriptionType: 'group_updates',
        resourceId: orivaGroupId
      }
    });
  } catch (error) {
    console.error('Group subscription endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get active subscriptions
app.get('/api/v1/subscriptions', validateApiKey, async (req, res) => {
  try {
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    const { data: subscriptions, error } = await supabase
      .from('extension_realtime_subscriptions')
      .select('*')
      .eq('extension_id', extensionId)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch subscriptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subscriptions'
      });
    }

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('Subscriptions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Unsubscribe from updates
app.delete('/api/v1/subscriptions/:subscriptionId', validateApiKey, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const extensionId = req.keyInfo.id;
    const userId = req.keyInfo.userId;

    const { error } = await supabase
      .from('extension_realtime_subscriptions')
      .update({ is_active: false })
      .eq('id', subscriptionId)
      .eq('extension_id', extensionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to unsubscribe:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe'
      });
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed'
    });
  } catch (error) {
    console.error('Unsubscribe endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### **Step 5.2: Add Webhook Endpoints (for Oriva Core)**
```javascript
// Add to api/index.js after subscription endpoints

// =============================================================================
// WEBHOOK ENDPOINTS (for Oriva Core to notify of changes)
// =============================================================================

// Receive profile update notifications from Oriva Core
app.post('/api/v1/webhooks/profile-updated', async (req, res) => {
  try {
    const { userId, profileId, eventType, timestamp, changes } = req.body;

    // Find all Extensions subscribed to this profile
    const { data: subscriptions, error } = await supabase
      .from('extension_realtime_subscriptions')
      .select('extension_id, user_id')
      .eq('user_id', userId)
      .eq('subscription_type', 'profile_updates')
      .eq('oriva_resource_id', profileId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch profile subscriptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }

    // TODO: Send real-time updates to subscribed Extensions
    // This could be implemented with WebSockets, Server-Sent Events, or push notifications
    console.log(`Profile ${profileId} updated for user ${userId}, notifying ${subscriptions.length} Extensions`);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      notificationsSent: subscriptions.length
    });
  } catch (error) {
    console.error('Profile webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Receive group membership change notifications from Oriva Core
app.post('/api/v1/webhooks/group-membership-changed', async (req, res) => {
  try {
    const { userId, groupId, eventType, timestamp } = req.body;

    // Find all Extensions subscribed to this group
    const { data: subscriptions, error } = await supabase
      .from('extension_realtime_subscriptions')
      .select('extension_id, user_id')
      .eq('user_id', userId)
      .eq('subscription_type', 'group_updates')
      .eq('oriva_resource_id', groupId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch group subscriptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }

    // TODO: Send real-time updates to subscribed Extensions
    console.log(`Group ${groupId} membership changed for user ${userId}, notifying ${subscriptions.length} Extensions`);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      notificationsSent: subscriptions.length
    });
  } catch (error) {
    console.error('Group webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

### **Step 5.3: Test Subscription Endpoints**
```bash
# Test subscription endpoints
curl -X POST -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"orivaProfileId": "profile_123"}' \
  http://localhost:3001/api/v1/subscriptions/profiles

curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  http://localhost:3001/api/v1/subscriptions
```

---

## 🎯 **Phase 6: SDK Updates (Week 6)**

### **Step 6.1: Update OrivaPluginSDK**
```typescript
// Update packages/plugin-sdk/src/OrivaPluginSDK.ts

export class OrivaPluginSDK {
  private activeProfileId: string | null = null;

  // Existing methods...

  // Profile management methods
  async getAvailableProfiles(): Promise<ExtensionProfile[]> {
    const response = await this.api.get('/api/v1/profiles/available');
    return response.data;
  }

  async switchProfile(orivaProfileId: string): Promise<ExtensionProfile> {
    const response = await this.api.post(`/api/v1/profiles/${orivaProfileId}/activate`);
    this.activeProfileId = orivaProfileId;
    return response.data.activeProfile;
  }

  async getCurrentProfile(): Promise<ExtensionProfile> {
    const response = await this.api.get('/api/v1/profiles/current');
    this.activeProfileId = response.data.activeProfile.profileId;
    return response.data.activeProfile;
  }

  async updateProfile(orivaProfileId: string, profileData: Partial<ExtensionProfile>): Promise<ExtensionProfile> {
    const response = await this.api.put(`/api/v1/profiles/${orivaProfileId}`, profileData);
    return response.data;
  }

  // Group management methods
  async getAvailableGroups(): Promise<ExtensionGroup[]> {
    const response = await this.api.get('/api/v1/groups');
    return response.data;
  }

  async getGroup(orivaGroupId: string): Promise<ExtensionGroup> {
    const response = await this.api.get(`/api/v1/groups/${orivaGroupId}`);
    return response.data;
  }

  async getGroupMembers(orivaGroupId: string): Promise<ExtensionGroupMember[]> {
    const response = await this.api.get(`/api/v1/groups/${orivaGroupId}/members`);
    return response.data;
  }

  // Real-time subscription methods
  async subscribeToProfileUpdates(orivaProfileId: string): Promise<Subscription> {
    const response = await this.api.post('/api/v1/subscriptions/profiles', {
      orivaProfileId,
      subscriptionType: 'profile_updates'
    });
    return response.data;
  }

  async subscribeToGroupUpdates(orivaGroupId: string): Promise<Subscription> {
    const response = await this.api.post('/api/v1/subscriptions/groups', {
      orivaGroupId,
      subscriptionType: 'group_updates'
    });
    return response.data;
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    const response = await this.api.get('/api/v1/subscriptions');
    return response.data;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.api.delete(`/api/v1/subscriptions/${subscriptionId}`);
  }
}

// Add new TypeScript interfaces
export interface ExtensionProfile {
  profileId: string; // Sanitized ID, not real Oriva Core ID
  profileName: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  customFields?: Record<string, any>;
}

export interface ExtensionGroup {
  groupId: string; // Sanitized ID, not real Oriva Core ID
  groupName: string;
  groupType: string;
  memberCount: number;
  userRole: string;
  joinedAt: string;
}

export interface ExtensionGroupMember {
  memberId: string; // Sanitized ID, not real user ID
  displayName: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
}

export interface Subscription {
  id: string;
  subscriptionType: string;
  resourceId: string;
  subscribedAt: string;
  isActive: boolean;
}
```

### **Step 6.2: Add React Hooks**
```typescript
// Add to packages/plugin-sdk/src/hooks/index.ts

import { useState, useCallback } from 'react';
import { OrivaPluginSDK, ExtensionProfile, ExtensionGroup } from '../OrivaPluginSDK';

// Profile management hook
export const useExtensionProfile = () => {
  const [activeProfile, setActiveProfile] = useState<ExtensionProfile | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<ExtensionProfile[]>([]);

  const switchProfile = useCallback(async (orivaProfileId: string) => {
    const profile = await sdk.switchProfile(orivaProfileId);
    setActiveProfile(profile);
  }, []);

  const getCurrentProfile = useCallback(async () => {
    const profile = await sdk.getCurrentProfile();
    setActiveProfile(profile);
    return profile;
  }, []);

  const getAvailableProfiles = useCallback(async () => {
    const profiles = await sdk.getAvailableProfiles();
    setAvailableProfiles(profiles);
    return profiles;
  }, []);

  return {
    activeProfile,
    availableProfiles,
    switchProfile,
    getCurrentProfile,
    getAvailableProfiles
  };
};

// Group management hook
export const useExtensionGroups = () => {
  const [availableGroups, setAvailableGroups] = useState<ExtensionGroup[]>([]);

  const getAvailableGroups = useCallback(async () => {
    const groups = await sdk.getAvailableGroups();
    setAvailableGroups(groups);
    return groups;
  }, []);

  const getGroup = useCallback(async (orivaGroupId: string) => {
    const group = await sdk.getGroup(orivaGroupId);
    return group;
  }, []);

  return {
    availableGroups,
    getAvailableGroups,
    getGroup
  };
};
```

### **Step 6.3: Test SDK Updates**
```bash
# Build and test SDK
cd packages/plugin-sdk
npm run build
npm test
```

---

## 🎯 **Phase 7: Testing & Documentation (Week 7)**

### **Step 7.1: Create Test Suite**
```javascript
// Create test/extension-endpoints.test.js

const request = require('supertest');
const app = require('../api/index');

describe('Extension Profile Endpoints', () => {
  const testApiKey = 'oriva_pk_test_test_key';
  
  test('GET /api/v1/profiles/available', async () => {
    const response = await request(app)
      .get('/api/v1/profiles/available')
      .set('Authorization', `Bearer ${testApiKey}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/v1/profiles/current', async () => {
    const response = await request(app)
      .get('/api/v1/profiles/current')
      .set('Authorization', `Bearer ${testApiKey}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.activeProfile).toBeDefined();
  });

  test('POST /api/v1/profiles/:orivaProfileId/activate', async () => {
    const response = await request(app)
      .post('/api/v1/profiles/profile_123/activate')
      .set('Authorization', `Bearer ${testApiKey}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.profileSwitched).toBe(true);
  });
});

describe('Extension Group Endpoints', () => {
  const testApiKey = 'oriva_pk_test_test_key';
  
  test('GET /api/v1/groups', async () => {
    const response = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${testApiKey}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### **Step 7.2: Create Documentation**
```markdown
# Create docs/extension-api.md

# Extension API Documentation

## Overview
The Extension API allows Extensions to access user profiles and groups managed in Oriva Core while maintaining complete privacy isolation.

## Authentication
All Extension API requests require authentication using an Extension API key:
```
Authorization: Bearer oriva_pk_test_your_extension_key
```

## Profile Management

### Get Available Profiles
```http
GET /api/v1/profiles/available
```

Returns all profiles the Extension has permission to access.

### Get Current Profile
```http
GET /api/v1/profiles/current
```

Returns the currently active profile for the Extension.

### Switch Profile
```http
POST /api/v1/profiles/{orivaProfileId}/activate
```

Switches the Extension to use a different profile.

## Group Management

### Get Available Groups
```http
GET /api/v1/groups
```

Returns all groups the Extension has permission to access.

### Get Group Details
```http
GET /api/v1/groups/{orivaGroupId}
```

Returns detailed information about a specific group.

## Real-time Subscriptions

### Subscribe to Profile Updates
```http
POST /api/v1/subscriptions/profiles
Content-Type: application/json

{
  "orivaProfileId": "profile_123"
}
```

### Subscribe to Group Updates
```http
POST /api/v1/subscriptions/groups
Content-Type: application/json

{
  "orivaGroupId": "group_456"
}
```
```

### **Step 7.3: Run Tests**
```bash
# Run test suite
npm test

# Run specific Extension tests
npm test -- --grep "Extension"
```

---

## 🎯 **Phase 8: Deployment (Week 8)**

### **Step 8.1: Deploy to Staging**
```bash
# Deploy to staging environment
vercel --target staging

# Test staging endpoints
curl -H "Authorization: Bearer oriva_pk_test_your_key_here" \
  https://oriva-platform-staging.vercel.app/api/v1/profiles/available
```

### **Step 8.2: Deploy to Production**
```bash
# Deploy to production
vercel --prod

# Test production endpoints
curl -H "Authorization: Bearer oriva_pk_live_your_key_here" \
  https://api.oriva.io/api/v1/profiles/available
```

### **Step 8.3: Monitor Deployment**
```bash
# Check logs
vercel logs

# Monitor API usage
# Check Supabase dashboard for new table usage
# Monitor error rates and performance
```

---

## 🎯 **Phase 9: Oriva Core Integration (Week 9)**

### **Step 9.1: Coordinate with Oriva Core Team**
- Share API specifications for Oriva Core endpoints
- Coordinate webhook implementation
- Test integration between Platform API and Oriva Core

### **Step 9.2: Implement Permission UI in Oriva Core**
- Extension installation flow
- Profile/group selection interface
- Permission management UI

### **Step 9.3: End-to-End Testing**
- Test complete Extension installation flow
- Test profile switching across Extensions
- Test real-time updates
- Test permission revocation

---

## 📋 **Summary**

This phased approach ensures:

1. **Incremental Development**: Each phase builds on the previous one
2. **No Disruption**: Existing API functionality remains unchanged
3. **Testable**: Each phase can be tested independently
4. **Deployable**: Each phase can be deployed independently
5. **Rollback Safe**: Can rollback individual phases if needed

The implementation follows the existing codebase patterns and integrates seamlessly with the current architecture.
