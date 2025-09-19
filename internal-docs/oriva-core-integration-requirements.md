# Oriva Core Integration Requirements

## Overview

This document outlines the requirements for the Oriva Core team to implement the backend APIs and UI components needed to support the new privacy-first multi-profile and group API endpoints in the Oriva Platform API.

## 🎯 **Core Concept**

The Oriva Platform API acts as a **secure bridge** between Oriva Core (where profiles and groups are managed) and third-party extensions. Oriva Core manages the actual data, while the Platform API provides sanitized, permission-controlled access.

## 📋 **Required Oriva Core APIs**

### 1. Profile Management API

#### **GET /api/internal/profiles/{userId}**
Returns all profiles for a user that an extension has permission to access.

**Request:**
```http
GET /api/internal/profiles/{userId}
Authorization: Bearer {platform_api_key}
X-Extension-ID: {extension_id}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "oriva_profile_id": "profile_1234567890abcdef",
      "profile_name": "Dating Profile",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "oriva_profile_id": "profile_fedcba0987654321",
      "profile_name": "Work Profile", 
      "is_active": false,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### **GET /api/internal/profiles/{userId}/active**
Returns the currently active profile for a user.

**Request:**
```http
GET /api/internal/profiles/{userId}/active
Authorization: Bearer {platform_api_key}
X-Extension-ID: {extension_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "oriva_profile_id": "profile_1234567890abcdef",
    "profile_name": "Dating Profile",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### **POST /api/internal/profiles/{userId}/activate**
Activates a specific profile for a user.

**Request:**
```http
POST /api/internal/profiles/{userId}/activate
Authorization: Bearer {platform_api_key}
X-Extension-ID: {extension_id}
Content-Type: application/json

{
  "oriva_profile_id": "profile_1234567890abcdef"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "oriva_profile_id": "profile_1234567890abcdef",
    "profile_name": "Dating Profile",
    "is_active": true,
    "activated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. Group Management API

#### **GET /api/internal/groups/{userId}**
Returns all groups a user is a member of that an extension has permission to access.

**Request:**
```http
GET /api/internal/groups/{userId}
Authorization: Bearer {platform_api_key}
X-Extension-ID: {extension_id}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "oriva_group_id": "group_1234567890abcdef",
      "group_name": "Dating Group",
      "member_count": 5,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "oriva_group_id": "group_fedcba0987654321",
      "group_name": "Work Group",
      "member_count": 12,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### **GET /api/internal/groups/{groupId}/members**
Returns all members of a specific group.

**Request:**
```http
GET /api/internal/groups/{groupId}/members
Authorization: Bearer {platform_api_key}
X-Extension-ID: {extension_id}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "oriva_member_id": "member_1234567890abcdef",
      "display_name": "John Doe",
      "role": "member",
      "joined_at": "2024-01-01T00:00:00Z"
    },
    {
      "oriva_member_id": "member_fedcba0987654321",
      "display_name": "Jane Smith",
      "role": "admin",
      "joined_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. Permission Management API

#### **GET /api/internal/permissions/{userId}/{extensionId}**
Returns all permissions an extension has for a user.

**Request:**
```http
GET /api/internal/permissions/{userId}/{extensionId}
Authorization: Bearer {platform_api_key}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user_1234567890abcdef",
    "extension_id": "ext_1234567890abcdef",
    "profile_permissions": [
      {
        "oriva_profile_id": "profile_1234567890abcdef",
        "profile_name": "Dating Profile",
        "permissions": ["read", "activate"],
        "granted_at": "2024-01-01T00:00:00Z"
      }
    ],
    "group_permissions": [
      {
        "oriva_group_id": "group_1234567890abcdef",
        "group_name": "Dating Group",
        "permissions": ["read", "members"],
        "granted_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

## 🎨 **Required UI Components**

### 1. Extension Authorization Flow

#### **Extension Installation Page**
When a user installs an extension, they need to see:

```jsx
// ExtensionAuthorizationPage.jsx
import React, { useState } from 'react';

const ExtensionAuthorizationPage = ({ extension, userProfiles, userGroups }) => {
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);

  return (
    <div className="extension-authorization">
      <h2>Authorize {extension.name}</h2>
      <p>{extension.description}</p>
      
      <div className="permission-section">
        <h3>Profile Access</h3>
        <p>Select which profiles this extension can access:</p>
        {userProfiles.map(profile => (
          <label key={profile.id}>
            <input
              type="checkbox"
              checked={selectedProfiles.includes(profile.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedProfiles([...selectedProfiles, profile.id]);
                } else {
                  setSelectedProfiles(selectedProfiles.filter(id => id !== profile.id));
                }
              }}
            />
            {profile.name}
          </label>
        ))}
      </div>

      <div className="permission-section">
        <h3>Group Access</h3>
        <p>Select which groups this extension can access:</p>
        {userGroups.map(group => (
          <label key={group.id}>
            <input
              type="checkbox"
              checked={selectedGroups.includes(group.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedGroups([...selectedGroups, group.id]);
                } else {
                  setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                }
              }}
            />
            {group.name} ({group.member_count} members)
          </label>
        ))}
      </div>

      <div className="actions">
        <button onClick={() => authorizeExtension(selectedProfiles, selectedGroups)}>
          Authorize Extension
        </button>
        <button onClick={() => cancelAuthorization()}>
          Cancel
        </button>
      </div>
    </div>
  );
};
```

#### **Profile Toggle Component**
For extensions to allow users to switch between authorized profiles:

```jsx
// ProfileToggle.jsx
import React, { useState, useEffect } from 'react';

const ProfileToggle = ({ extensionId, onProfileChange }) => {
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);

  useEffect(() => {
    // Fetch authorized profiles for this extension
    fetchAuthorizedProfiles(extensionId).then(setProfiles);
  }, [extensionId]);

  const handleProfileChange = (profileId) => {
    setActiveProfile(profileId);
    onProfileChange(profileId);
  };

  return (
    <div className="profile-toggle">
      <label>Active Profile:</label>
      <select 
        value={activeProfile?.id || ''} 
        onChange={(e) => handleProfileChange(e.target.value)}
      >
        <option value="">Select Profile</option>
        {profiles.map(profile => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </div>
  );
};
```

### 2. Permission Management UI

#### **Extension Settings Page**
Allow users to manage their extension permissions:

```jsx
// ExtensionSettingsPage.jsx
import React, { useState } from 'react';

const ExtensionSettingsPage = ({ extension, currentPermissions }) => {
  const [permissions, setPermissions] = useState(currentPermissions);

  const updatePermissions = (type, id, newPermissions) => {
    // Update permissions in Oriva Core
    updateExtensionPermissions(extension.id, type, id, newPermissions);
  };

  return (
    <div className="extension-settings">
      <h2>{extension.name} Settings</h2>
      
      <div className="permission-section">
        <h3>Profile Permissions</h3>
        {permissions.profile_permissions.map(permission => (
          <div key={permission.profile_id} className="permission-item">
            <h4>{permission.profile_name}</h4>
            <div className="permission-options">
              <label>
                <input
                  type="checkbox"
                  checked={permission.permissions.includes('read')}
                  onChange={(e) => updatePermissions('profile', permission.profile_id, {
                    ...permission.permissions,
                    read: e.target.checked
                  })}
                />
                Read Access
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={permission.permissions.includes('activate')}
                  onChange={(e) => updatePermissions('profile', permission.profile_id, {
                    ...permission.permissions,
                    activate: e.target.checked
                  })}
                />
                Profile Switching
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="permission-section">
        <h3>Group Permissions</h3>
        {permissions.group_permissions.map(permission => (
          <div key={permission.group_id} className="permission-item">
            <h4>{permission.group_name}</h4>
            <div className="permission-options">
              <label>
                <input
                  type="checkbox"
                  checked={permission.permissions.includes('read')}
                  onChange={(e) => updatePermissions('group', permission.group_id, {
                    ...permission.permissions,
                    read: e.target.checked
                  })}
                />
                Read Access
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={permission.permissions.includes('members')}
                  onChange={(e) => updatePermissions('group', permission.group_id, {
                    ...permission.permissions,
                    members: e.target.checked
                  })}
                />
                Member Access
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 🗄️ **Database Schema Requirements**

### 1. Extension Profile Permissions Table

```sql
CREATE TABLE extension_profile_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_profile_id VARCHAR(255) NOT NULL, -- Profile ID from Oriva Core
  profile_name VARCHAR(255) NOT NULL, -- "Dating Profile", "Work Profile", "Anon Profile"
  permissions TEXT[] DEFAULT '{"read"}', -- ["read", "activate"]
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_profile_id)
);

-- Indexes for performance
CREATE INDEX idx_extension_profile_permissions_extension_user 
ON extension_profile_permissions(extension_id, user_id);
CREATE INDEX idx_extension_profile_permissions_user 
ON extension_profile_permissions(user_id);
```

### 2. Extension Group Permissions Table

```sql
CREATE TABLE extension_group_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_group_id VARCHAR(255) NOT NULL, -- Group ID from Oriva Core
  group_name VARCHAR(255) NOT NULL, -- "Dating Group", "Work Group"
  permissions TEXT[] DEFAULT '{"read"}', -- ["read", "members"]
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_group_id)
);

-- Indexes for performance
CREATE INDEX idx_extension_group_permissions_extension_user 
ON extension_group_permissions(extension_id, user_id);
CREATE INDEX idx_extension_group_permissions_user 
ON extension_group_permissions(user_id);
```

### 3. Extension Active Profiles Table

```sql
CREATE TABLE extension_active_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_profile_id VARCHAR(255) NOT NULL, -- Currently active profile
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(extension_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_extension_active_profiles_extension_user 
ON extension_active_profiles(extension_id, user_id);
```

## 🔐 **Security Requirements**

### 1. API Key Validation
- All internal API calls must include valid Platform API key
- Extension ID must be validated against the API key
- User ID must be validated against the extension's permissions

### 2. Permission Validation
- Check if extension has permission to access specific profile/group
- Validate user ownership of profiles/groups
- Ensure active profile is within authorized profiles

### 3. Data Sanitization
- Never expose internal Oriva Core IDs to Platform API
- Sanitize all data before sending to Platform API
- Remove sensitive information (emails, internal usernames, etc.)

## 🚀 **Implementation Priority**

### Phase 1: Core APIs (High Priority)
1. Profile Management API endpoints
2. Group Management API endpoints
3. Basic permission validation

### Phase 2: UI Components (Medium Priority)
1. Extension authorization flow
2. Profile toggle component
3. Permission management UI

### Phase 3: Advanced Features (Low Priority)
1. Real-time webhook notifications
2. Advanced permission granularity
3. Audit logging and analytics

## 📞 **Integration Points**

### 1. Platform API Integration
- Platform API will call Oriva Core internal APIs
- Oriva Core will validate permissions and return sanitized data
- Platform API will further sanitize data for external consumption

### 2. User Experience Flow
1. User installs extension in Oriva app
2. Oriva app shows authorization page with profile/group selection
3. User selects which profiles/groups to authorize
4. Extension can access authorized data through Platform API
5. User can manage permissions in extension settings

### 3. Data Flow
```
User → Oriva Core → Platform API → Extension
     ← Oriva Core ← Platform API ← Extension
```

## 🔍 **Testing Requirements**

### 1. API Testing
- Unit tests for all internal API endpoints
- Integration tests with Platform API
- Permission validation tests

### 2. UI Testing
- Component tests for authorization flow
- User interaction tests
- Permission management tests

### 3. Security Testing
- Permission bypass attempts
- Data leakage tests
- API key validation tests

## 📋 **Deliverables Checklist**

- [ ] Internal API endpoints implemented
- [ ] Database schema created
- [ ] Permission validation logic
- [ ] UI components for authorization
- [ ] Profile toggle component
- [ ] Permission management UI
- [ ] Security testing completed
- [ ] Integration testing with Platform API
- [ ] Documentation for internal APIs
- [ ] User guide for extension authorization

## 🎯 **Success Criteria**

1. **Functional**: All API endpoints work correctly
2. **Secure**: No data leakage or permission bypasses
3. **User-Friendly**: Clear authorization flow and permission management
4. **Performant**: Fast response times for all operations
5. **Maintainable**: Clean, well-documented code

## 📞 **Next Steps**

1. **Review Requirements**: Oriva Core team reviews this document
2. **Technical Planning**: Break down implementation into tasks
3. **API Development**: Implement internal APIs first
4. **UI Development**: Build authorization and management components
5. **Integration Testing**: Test with Platform API
6. **Security Audit**: Comprehensive security testing
7. **Documentation**: Complete API and user documentation
8. **Deployment**: Deploy to staging and production

---

**Contact**: Platform API team for any questions or clarifications about these requirements.
