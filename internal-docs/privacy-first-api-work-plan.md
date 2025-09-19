# 🛡️ Privacy-First Multi-Profile & Group API - Work Plan

> **Comprehensive development plan for implementing multi-profile privacy controls and group management APIs**

## 🎯 **Project Overview**

### **Vision Statement**
Enable Oriva Extension apps to access user profiles and groups managed within Oriva Core, while maintaining complete privacy isolation between profiles and providing real-time updates from the Oriva network.

### **Key Features**
1. **Profile Visibility API**: Extension apps can access user profiles created in Oriva Core
2. **Profile Isolation**: Each profile appears completely separate to developers (no cross-profile detection)
3. **Profile Switching**: Users can switch between authorized profiles within Extension apps
4. **Group Visibility API**: Extension apps can access groups the user is a member of in Oriva Core
5. **Real-time Updates**: Live updates from Oriva Core network for profiles and groups
6. **Permission UI**: Standard components for profile authorization during Extension installation
7. **Data Sanitization**: Universal privacy protection with sanitized API responses

---

## 📋 **Phase 1: Database Architecture (Week 1-2)**

### **1.1 Extension Profile Permissions Schema**
```sql
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
```

### **1.2 Extension Group Visibility Schema**
```sql
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
```

### **1.3 Indexes and Constraints**
```sql
-- Profile indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_type ON user_profiles(profile_type);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX idx_app_profile_permissions_app_id ON app_profile_permissions(app_id);
CREATE INDEX idx_app_profile_permissions_user_id ON app_profile_permissions(user_id);

-- Group indexes
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_type ON groups(group_type);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_sessions_group_id ON group_sessions(group_id);
CREATE INDEX idx_group_sessions_status ON group_sessions(status);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_group_permissions ENABLE ROW LEVEL SECURITY;
```

---

## 📋 **Oriva Core Integration Requirements**

### **Core Team Requirements**
The Oriva Core team needs to implement the following to support Extension profile and group visibility:

#### **1. Profile Management API (Oriva Core)**
```javascript
// Oriva Core needs to expose these endpoints for the Platform API
GET /api/core/profiles/{userId} - Get all profiles for a user
GET /api/core/profiles/{userId}/{profileId} - Get specific profile data
PUT /api/core/profiles/{userId}/{profileId} - Update profile data
POST /api/core/profiles/{userId} - Create new profile
DELETE /api/core/profiles/{userId}/{profileId} - Delete profile

// Profile data structure expected from Oriva Core
{
  "profileId": "profile_123",
  "profileName": "Dating Profile",
  "displayName": "John Doe",
  "bio": "Looking for meaningful connections",
  "avatarUrl": "https://...",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "customFields": {
    "age": 28,
    "interests": ["photography", "hiking"],
    "relationshipGoals": "serious"
  },
  "isDefault": false,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

#### **2. Group Management API (Oriva Core)**
```javascript
// Oriva Core needs to expose these endpoints for the Platform API
GET /api/core/groups/{userId} - Get all groups user is member of
GET /api/core/groups/{userId}/{groupId} - Get specific group data
GET /api/core/groups/{userId}/{groupId}/members - Get group members

// Group data structure expected from Oriva Core
{
  "groupId": "group_456",
  "groupName": "Frontend Team",
  "groupType": "work",
  "description": "Our amazing frontend development team",
  "memberCount": 8,
  "userRole": "member", // "admin", "moderator", "member"
  "joinedAt": "2024-01-10T09:00:00Z",
  "isPrivate": true
}
```

#### **3. Real-time Webhook System (Oriva Core)**
```javascript
// Oriva Core needs to send webhooks to Platform API when data changes
POST /api/platform/webhooks/profile-updated
{
  "userId": "user_789",
  "profileId": "profile_123",
  "eventType": "profile_updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "changes": ["displayName", "bio"]
}

POST /api/platform/webhooks/group-membership-changed
{
  "userId": "user_789",
  "groupId": "group_456",
  "eventType": "group_joined", // "group_joined", "group_left", "group_updated"
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **4. Permission UI Components (Oriva Core)**
```javascript
// Oriva Core needs to implement Extension installation flow
// When user installs an Extension, show profile selection UI:

const ExtensionInstallationFlow = () => {
  return (
    <div className="extension-installation">
      <h2>Install {extensionName}</h2>
      <p>This extension would like to access your profiles and groups:</p>
      
      <div className="profile-selection">
        <h3>Select Profiles to Share:</h3>
        {userProfiles.map(profile => (
          <label key={profile.id}>
            <input 
              type="checkbox" 
              checked={selectedProfiles.includes(profile.id)}
              onChange={(e) => toggleProfile(profile.id)}
            />
            {profile.profileName} ({profile.displayName})
          </label>
        ))}
      </div>
      
      <div className="group-selection">
        <h3>Select Groups to Share:</h3>
        {userGroups.map(group => (
          <label key={group.id}>
            <input 
              type="checkbox" 
              checked={selectedGroups.includes(group.id)}
              onChange={(e) => toggleGroup(group.id)}
            />
            {group.groupName}
          </label>
        ))}
      </div>
      
      <button onClick={installExtension}>
        Install Extension
      </button>
    </div>
  );
};
```

---

## 📋 **Phase 2: API Endpoint Implementation (Week 3-4)**

### **2.1 Extension Profile Visibility Endpoints**
```javascript
// Profile visibility (profiles managed in Oriva Core)
GET /api/v1/profiles - Get authorized profiles for current extension
GET /api/v1/profiles/{orivaProfileId} - Get specific profile data (if authorized)
PUT /api/v1/profiles/{orivaProfileId} - Update profile data (if authorized)

// Profile switching and context
GET /api/v1/profiles/current - Get currently active profile for extension
POST /api/v1/profiles/{orivaProfileId}/activate - Switch to specific profile
GET /api/v1/profiles/available - Get profiles available to current extension

// Profile data management (delegated to Oriva Core)
GET /api/v1/profiles/{orivaProfileId}/data - Get profile custom fields
PUT /api/v1/profiles/{orivaProfileId}/data - Update profile custom fields
```

### **2.2 Extension Group Visibility Endpoints**
```javascript
// Group visibility (groups managed in Oriva Core)
GET /api/v1/groups - Get authorized groups for current extension
GET /api/v1/groups/{orivaGroupId} - Get specific group data (if authorized)
GET /api/v1/groups/{orivaGroupId}/members - Get group members (if authorized)

// Real-time subscriptions
POST /api/v1/subscriptions/profiles - Subscribe to profile updates
POST /api/v1/subscriptions/groups - Subscribe to group updates
GET /api/v1/subscriptions - Get active subscriptions
DELETE /api/v1/subscriptions/{subscriptionId} - Unsubscribe from updates
```

### **2.3 Extension Permission Management Endpoints**
```javascript
// Extension permission management (handled during installation in Oriva Core)
GET /api/v1/permissions/profiles - Get authorized profiles for current extension
GET /api/v1/permissions/groups - Get authorized groups for current extension

// Permission revocation (user can revoke in Oriva Core)
DELETE /api/v1/permissions/profiles/{orivaProfileId} - Revoke profile access
DELETE /api/v1/permissions/groups/{orivaGroupId} - Revoke group access

// Webhook endpoints (for Oriva Core to notify of changes)
POST /api/v1/webhooks/profile-updated - Receive profile update notifications
POST /api/v1/webhooks/group-membership-changed - Receive group change notifications
POST /api/v1/webhooks/permission-revoked - Receive permission revocation notifications
```

---

## 📋 **Phase 3: Privacy & Security Implementation (Week 5)**

### **3.1 Extension Data Sanitization Middleware**
```javascript
// Profile data sanitization for Extensions
function sanitizeProfileDataForExtension(profile, extensionPermissions) {
  const sanitized = {
    profileId: generatePublicId(profile.orivaProfileId), // Never expose real Oriva Core IDs
    profileName: profile.profileName,
    displayName: profile.displayName,
    // Only include fields the extension has permission to see
  };

  // Always include basic profile info for authorized extensions
  sanitized.bio = profile.bio;
  sanitized.avatarUrl = profile.avatarUrl;
  sanitized.location = profile.location;
  sanitized.website = profile.website;
  sanitized.customFields = profile.customFields;

  // NEVER include: user_id, oriva_profile_id, internal Oriva Core IDs
  // Each profile appears completely separate to prevent cross-profile detection
  return sanitized;
}

// Group data sanitization for Extensions
function sanitizeGroupDataForExtension(group, extensionPermissions) {
  return {
    groupId: generatePublicId(group.orivaGroupId), // Never expose real Oriva Core IDs
    groupName: group.groupName,
    groupType: group.groupType,
    memberCount: group.memberCount,
    userRole: group.userRole,
    joinedAt: group.joinedAt,
    // NEVER include: description, created_by, internal Oriva Core IDs
  };
}

// Group member data sanitization
function sanitizeGroupMemberData(member) {
  return {
    memberId: generatePublicId(member.userId), // Never expose real user IDs
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    role: member.role,
    joinedAt: member.joinedAt,
    // NEVER include: user_id, email, full profile details
  };
}
```

### **3.2 Extension Permission Validation System**
```javascript
// Middleware for Extension profile access validation
const validateExtensionProfileAccess = async (req, res, next) => {
  const { orivaProfileId } = req.params;
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  const permission = await supabase
    .from('extension_profile_permissions')
    .select('*')
    .eq('extension_id', extensionId)
    .eq('oriva_profile_id', orivaProfileId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!permission) {
    return res.status(403).json({
      success: false,
      error: 'Extension does not have access to this profile'
    });
  }

  req.extensionProfilePermission = permission;
  next();
};

// Middleware for Extension group access validation
const validateExtensionGroupAccess = async (req, res, next) => {
  const { orivaGroupId } = req.params;
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  const permission = await supabase
    .from('extension_group_permissions')
    .select('*')
    .eq('extension_id', extensionId)
    .eq('oriva_group_id', orivaGroupId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!permission) {
    return res.status(403).json({
      success: false,
      error: 'Extension does not have access to this group'
    });
  }

  req.extensionGroupPermission = permission;
  next();
};

// Middleware to fetch profile data from Oriva Core
const fetchProfileFromOrivaCore = async (req, res, next) => {
  const { orivaProfileId } = req.params;
  const userId = req.keyInfo.userId;

  try {
    // Call Oriva Core API to get profile data
    const profileResponse = await fetch(`${ORIVA_CORE_API_URL}/api/core/profiles/${userId}/${orivaProfileId}`, {
      headers: {
        'Authorization': `Bearer ${ORIVA_CORE_SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!profileResponse.ok) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found in Oriva Core'
      });
    }

    const profileData = await profileResponse.json();
    req.orivaProfileData = profileData;
    next();
  } catch (error) {
    console.error('Error fetching profile from Oriva Core:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile data'
    });
  }
};
```

---

## 📋 **Phase 4: Extension Profile Toggle Feature (Week 6)**

### **4.1 Extension Profile Context Management**
```javascript
// Extension profile switching endpoint
app.post('/api/v1/profiles/:orivaProfileId/activate', validateApiKey, validateExtensionProfileAccess, async (req, res) => {
  const { orivaProfileId } = req.params;
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  // Update active profile in extension session
  await supabase
    .from('extension_active_profiles')
    .upsert({
      extension_id: extensionId,
      user_id: userId,
      active_oriva_profile_id: orivaProfileId,
      last_accessed_at: new Date().toISOString()
    });

  // Get available profiles for this extension
  const availableProfiles = await getAvailableProfilesForExtension(extensionId, userId);

  res.json({
    success: true,
    data: {
      activeProfile: await sanitizeProfileDataForExtension(req.orivaProfileData, req.extensionProfilePermission),
      availableProfiles: availableProfiles,
      profileSwitched: true
    }
  });
});

// Get current profile context for extension
app.get('/api/v1/profiles/current', validateApiKey, async (req, res) => {
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  const activeSession = await supabase
    .from('extension_active_profiles')
    .select('active_oriva_profile_id')
    .eq('extension_id', extensionId)
    .eq('user_id', userId)
    .single();

  if (!activeSession?.active_oriva_profile_id) {
    // Return default profile (Anon profile)
    const defaultProfile = await fetchDefaultProfileFromOrivaCore(userId);
    
    return res.json({
      success: true,
      data: {
        activeProfile: await sanitizeProfileDataForExtension(defaultProfile, {}),
        isDefault: true,
        profileName: 'Anon Profile'
      }
    });
  }

  // Fetch current active profile from Oriva Core
  const profileData = await fetchProfileFromOrivaCore(userId, activeSession.active_oriva_profile_id);
  
  res.json({
    success: true,
    data: {
      activeProfile: await sanitizeProfileDataForExtension(profileData, {}),
      isDefault: false
    }
  });
});

// Get available profiles for extension
app.get('/api/v1/profiles/available', validateApiKey, async (req, res) => {
  const extensionId = req.keyInfo.id;
  const userId = req.keyInfo.userId;

  const availableProfiles = await getAvailableProfilesForExtension(extensionId, userId);
  
  res.json({
    success: true,
    data: availableProfiles
  });
});

// Helper function to get available profiles for extension
async function getAvailableProfilesForExtension(extensionId, userId) {
  const permissions = await supabase
    .from('extension_profile_permissions')
    .select('oriva_profile_id, profile_name')
    .eq('extension_id', extensionId)
    .eq('user_id', userId)
    .eq('is_active', true);

  const profiles = [];
  for (const permission of permissions.data) {
    const profileData = await fetchProfileFromOrivaCore(userId, permission.oriva_profile_id);
    profiles.push(await sanitizeProfileDataForExtension(profileData, permission));
  }

  return profiles;
}
```

### **4.2 Extension Integration Examples**
```javascript
// React component for Extension profile switching
const ExtensionProfileToggle = ({ extensionId, userId }) => {
  const [activeProfile, setActiveProfile] = useState(null);
  const [availableProfiles, setAvailableProfiles] = useState([]);

  const switchProfile = async (orivaProfileId) => {
    const response = await fetch(`/api/v1/profiles/${orivaProfileId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${extensionApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      setActiveProfile(data.data.activeProfile);
      setAvailableProfiles(data.data.availableProfiles);
      
      // Notify extension that profile context has changed
      window.dispatchEvent(new CustomEvent('orivaProfileChanged', {
        detail: {
          activeProfile: data.data.activeProfile,
          availableProfiles: data.data.availableProfiles
        }
      }));
    }
  };

  return (
    <div className="extension-profile-toggle">
      <h3>Active Profile: {activeProfile?.displayName}</h3>
      <select onChange={(e) => switchProfile(e.target.value)}>
        {availableProfiles.map(profile => (
          <option key={profile.profileId} value={profile.profileId}>
            {profile.profileName}
          </option>
        ))}
      </select>
    </div>
  );
};

// Extension SDK hook for profile management
export const useExtensionProfile = () => {
  const [activeProfile, setActiveProfile] = useState(null);
  const [availableProfiles, setAvailableProfiles] = useState([]);

  const switchProfile = useCallback(async (orivaProfileId) => {
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
```

---

## 📋 **Phase 5: Extension Developer Experience (Week 7)**

### **5.1 Enhanced Extension SDK**
```typescript
// Enhanced OrivaPluginSDK with Extension profile and group support
export class OrivaPluginSDK {
  private activeProfileId: string | null = null;

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
}

// TypeScript interfaces for Extension data
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

// React hooks for Extension profile management
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

  return {
    activeProfile,
    availableProfiles,
    switchProfile,
    getCurrentProfile
  };
};

// React hooks for Extension group management
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

### **5.2 Extension Documentation & Examples**
- **Extension API Reference**: Complete documentation for all Extension endpoints
- **Privacy-First Development Guide**: How to build privacy-respecting Extensions
- **Profile Toggle Tutorial**: Step-by-step guide for implementing Extension profile switching
- **Group Visibility Guide**: Building Extensions that leverage Oriva Core groups
- **Real-time Updates Guide**: Implementing live updates from Oriva Core network
- **Extension Use Case Examples**: 
  - **Dating Extension**: Access dating profiles, create matches, manage conversations
  - **Professional Networking Extension**: Access work profiles, manage professional connections
  - **Gaming Extension**: Access gaming profiles, create gaming groups, manage game sessions
  - **Team Collaboration Extension**: Access work groups, manage team projects, coordinate meetings

---

## 📋 **Phase 6: Testing & Security Audit (Week 8)**

### **6.1 Extension Security Testing**
- **Permission Bypass Testing**: Ensure Extensions cannot access unauthorized profiles/groups
- **Data Leakage Testing**: Verify sanitization prevents cross-profile detection
- **Profile Isolation Testing**: Ensure Extensions cannot link profiles to same user
- **Oriva Core Integration Testing**: Verify secure communication with Oriva Core API
- **Rate Limiting Testing**: Ensure new endpoints respect rate limits

### **6.2 Extension Privacy Audit**
- **Data Minimization Review**: Ensure only necessary profile/group data is exposed
- **Profile Isolation Review**: Verify complete separation between profiles
- **Consent Flow Testing**: Verify Extension installation permission flow
- **Access Control Testing**: Test Extension permission system
- **Data Retention Testing**: Ensure proper cleanup when Extensions are removed

### **6.3 Extension Performance Testing**
- **Oriva Core API Integration**: Test performance of calls to Oriva Core
- **Profile Switching Performance**: Ensure fast profile context switching
- **Real-time Update Performance**: Test webhook processing and delivery
- **Concurrent Extension Testing**: Test multiple Extensions accessing same user data
- **Memory Usage Testing**: Monitor for memory leaks in profile switching

---

## 📋 **Phase 7: Deployment & Monitoring (Week 9)**

### **7.1 Gradual Rollout**
- **Feature Flags**: Enable new endpoints gradually
- **A/B Testing**: Test with subset of users first
- **Monitoring**: Track API usage and performance
- **Feedback Collection**: Gather developer and user feedback

### **7.2 Extension Production Monitoring**
- **Extension API Metrics**: Track Extension endpoint usage and performance
- **Profile Switching Metrics**: Monitor profile switching frequency and patterns
- **Oriva Core Integration Metrics**: Track API calls to Oriva Core
- **Error Monitoring**: Monitor for permission errors and data leaks
- **Extension Adoption**: Monitor Extension usage and developer adoption
- **Real-time Update Metrics**: Track webhook delivery and processing

---

## 🎯 **Success Metrics**

### **Technical Metrics**
- **API Response Time**: < 200ms for profile/group endpoints
- **Error Rate**: < 0.1% for permission validation
- **Data Leakage**: 0 instances of unauthorized data access
- **Uptime**: 99.9% availability for new endpoints

### **Extension User Experience Metrics**
- **Profile Adoption**: % of users creating multiple profiles in Oriva Core
- **Extension Permission Grant Rate**: % of users granting Extension permissions
- **Profile Switching**: Frequency of profile switching within Extensions
- **User Satisfaction**: Survey scores for Extension privacy controls

### **Extension Developer Adoption Metrics**
- **Extension API Usage**: Number of Extensions using new endpoints
- **Profile/Group Access Requests**: Number of Extensions requesting profile/group access
- **Extension Documentation Usage**: Views and engagement with Extension docs
- **Developer Feedback**: Satisfaction scores from Extension developer surveys
- **Extension Marketplace Growth**: Number of Extensions leveraging profile/group features

---

## 🚀 **Timeline Summary**

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** | Week 1-2 | Extension database schema, Oriva Core integration setup |
| **Phase 2** | Week 3-4 | Extension API endpoints, Oriva Core communication |
| **Phase 3** | Week 5 | Extension privacy middleware, data sanitization |
| **Phase 4** | Week 6 | Extension profile toggle, context management |
| **Phase 5** | Week 7 | Extension SDK updates, documentation, examples |
| **Phase 6** | Week 8 | Extension security testing, privacy audit, performance |
| **Phase 7** | Week 9 | Extension deployment, monitoring, gradual rollout |

**Total Timeline: 9 weeks**

---

## 🔒 **Privacy & Security Considerations**

### **Extension Data Protection**
- **Minimal Data Exposure**: Only expose data Extensions are authorized to see
- **Profile Isolation**: Complete separation between profiles to prevent cross-profile detection
- **Data Sanitization**: Universal sanitization for all profile/group data
- **Access Logging**: Log all Extension data access for audit trails
- **Data Retention**: Automatic cleanup when Extensions are removed

### **Extension User Control**
- **Granular Permissions**: Users control exactly which profiles/groups each Extension can access
- **Easy Revocation**: One-click permission revocation in Oriva Core
- **Transparent Access**: Users can see what data each Extension accesses
- **Consent Management**: Clear consent flows during Extension installation

### **Extension Developer Guidelines**
- **Privacy by Design**: Extensions must implement privacy-first patterns
- **Data Minimization**: Only request necessary profile/group permissions
- **Transparent Usage**: Clear communication about data usage
- **Security Best Practices**: Follow platform security guidelines
- **Profile Isolation**: Never attempt to link profiles or detect cross-profile relationships

---

## 📞 **Next Steps**

1. **Review & Approve**: Review this work plan with the team
2. **Oriva Core Coordination**: Coordinate with Oriva Core team on integration requirements
3. **Resource Allocation**: Assign developers to each phase
4. **Environment Setup**: Prepare development and testing environments
5. **Begin Phase 1**: Start with Extension database schema design
6. **Regular Reviews**: Weekly progress reviews and adjustments

## 🎯 **Key Dependencies**

### **Oriva Core Team Requirements**
- **Profile Management API**: Expose profile CRUD operations to Platform API
- **Group Management API**: Expose group visibility to Platform API
- **Real-time Webhook System**: Send notifications when data changes
- **Permission UI Components**: Extension installation flow with profile/group selection

### **Platform API Team Deliverables**
- **Extension Database Schema**: Track Extension permissions and active profiles
- **Extension API Endpoints**: Provide secure access to Oriva Core data
- **Privacy Middleware**: Ensure complete profile isolation and data sanitization
- **Extension SDK**: Developer tools for building profile-aware Extensions

This work plan provides a comprehensive roadmap for implementing the privacy-first Extension profile and group visibility system that will position Oriva as the most privacy-respecting and developer-friendly social platform.
