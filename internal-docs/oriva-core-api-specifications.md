# Oriva Core API Specifications

## Overview

This document provides detailed technical specifications for the internal APIs that Oriva Core must implement to support the Platform API's privacy-first multi-profile and group endpoints.

## 🔐 **Authentication & Authorization**

### API Key Format
All internal API calls must include:
- `Authorization: Bearer {platform_api_key}`
- `X-Extension-ID: {extension_id}`
- `Content-Type: application/json` (for POST requests)

### Validation Flow
1. Validate Platform API key against internal registry
2. Validate Extension ID against API key
3. Check if extension has permission to access user data
4. Validate user ownership of requested resources

## 📋 **API Endpoints**

### 1. Profile Management

#### **GET /api/internal/profiles/{userId}**
**Purpose**: Retrieve all profiles for a user that an extension has permission to access.

**Parameters**:
- `userId` (path): UUID of the user
- `extension_id` (header): Extension ID from X-Extension-ID header

**Request Example**:
```http
GET /api/internal/profiles/user_1234567890abcdef
Authorization: Bearer platform_api_key_here
X-Extension-ID: ext_1234567890abcdef
```

**Response Schema**:
```json
{
  "success": boolean,
  "data": [
    {
      "oriva_profile_id": "string", // Internal profile ID
      "profile_name": "string",     // User-friendly name
      "is_active": boolean,         // Currently active profile
      "created_at": "string",       // ISO 8601 timestamp
      "updated_at": "string"        // ISO 8601 timestamp
    }
  ],
  "error": "string" // Only present if success is false
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid API key or extension ID
- `403 Forbidden`: Extension not authorized for this user
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

#### **GET /api/internal/profiles/{userId}/active**
**Purpose**: Get the currently active profile for a user.

**Parameters**:
- `userId` (path): UUID of the user
- `extension_id` (header): Extension ID from X-Extension-ID header

**Response Schema**:
```json
{
  "success": boolean,
  "data": {
    "oriva_profile_id": "string",
    "profile_name": "string",
    "is_active": boolean,
    "created_at": "string",
    "updated_at": "string"
  },
  "error": "string"
}
```

#### **POST /api/internal/profiles/{userId}/activate**
**Purpose**: Activate a specific profile for a user.

**Parameters**:
- `userId` (path): UUID of the user
- `extension_id` (header): Extension ID from X-Extension-ID header

**Request Body**:
```json
{
  "oriva_profile_id": "string" // Profile ID to activate
}
```

**Response Schema**:
```json
{
  "success": boolean,
  "data": {
    "oriva_profile_id": "string",
    "profile_name": "string",
    "is_active": boolean,
    "activated_at": "string" // ISO 8601 timestamp
  },
  "error": "string"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid profile ID or user doesn't own profile
- `403 Forbidden`: Extension not authorized for this profile
- `404 Not Found`: Profile not found

### 2. Group Management

#### **GET /api/internal/groups/{userId}**
**Purpose**: Retrieve all groups a user is a member of that an extension has permission to access.

**Parameters**:
- `userId` (path): UUID of the user
- `extension_id` (header): Extension ID from X-Extension-ID header

**Response Schema**:
```json
{
  "success": boolean,
  "data": [
    {
      "oriva_group_id": "string",    // Internal group ID
      "group_name": "string",        // User-friendly name
      "member_count": number,        // Number of members
      "is_active": boolean,          // Group is active
      "created_at": "string",        // ISO 8601 timestamp
      "updated_at": "string"         // ISO 8601 timestamp
    }
  ],
  "error": "string"
}
```

#### **GET /api/internal/groups/{groupId}/members**
**Purpose**: Get all members of a specific group.

**Parameters**:
- `groupId` (path): UUID of the group
- `extension_id` (header): Extension ID from X-Extension-ID header

**Response Schema**:
```json
{
  "success": boolean,
  "data": [
    {
      "oriva_member_id": "string",   // Internal member ID
      "display_name": "string",      // Display name only
      "role": "string",              // "admin", "moderator", "member"
      "joined_at": "string"          // ISO 8601 timestamp
    }
  ],
  "error": "string"
}
```

**Error Responses**:
- `403 Forbidden`: Extension not authorized for this group
- `404 Not Found`: Group not found or user not a member

### 3. Permission Management

#### **GET /api/internal/permissions/{userId}/{extensionId}**
**Purpose**: Get all permissions an extension has for a user.

**Parameters**:
- `userId` (path): UUID of the user
- `extensionId` (path): UUID of the extension

**Response Schema**:
```json
{
  "success": boolean,
  "data": {
    "user_id": "string",
    "extension_id": "string",
    "profile_permissions": [
      {
        "oriva_profile_id": "string",
        "profile_name": "string",
        "permissions": ["string"], // ["read", "activate"]
        "granted_at": "string"
      }
    ],
    "group_permissions": [
      {
        "oriva_group_id": "string",
        "group_name": "string",
        "permissions": ["string"], // ["read", "members"]
        "granted_at": "string"
      }
    ]
  },
  "error": "string"
}
```

#### **POST /api/internal/permissions/{userId}/{extensionId}**
**Purpose**: Update permissions for an extension.

**Request Body**:
```json
{
  "profile_permissions": [
    {
      "oriva_profile_id": "string",
      "permissions": ["string"]
    }
  ],
  "group_permissions": [
    {
      "oriva_group_id": "string",
      "permissions": ["string"]
    }
  ]
}
```

**Response Schema**:
```json
{
  "success": boolean,
  "data": {
    "updated_at": "string"
  },
  "error": "string"
}
```

## 🗄️ **Database Schema**

### 1. Extension Profile Permissions
```sql
CREATE TABLE extension_profile_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_profile_id VARCHAR(255) NOT NULL,
  profile_name VARCHAR(255) NOT NULL,
  permissions TEXT[] DEFAULT '{"read"}',
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_profile_id)
);

-- Indexes
CREATE INDEX idx_extension_profile_permissions_extension_user 
ON extension_profile_permissions(extension_id, user_id);
CREATE INDEX idx_extension_profile_permissions_user 
ON extension_profile_permissions(user_id);
CREATE INDEX idx_extension_profile_permissions_profile 
ON extension_profile_permissions(oriva_profile_id);
```

### 2. Extension Group Permissions
```sql
CREATE TABLE extension_group_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_group_id VARCHAR(255) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  permissions TEXT[] DEFAULT '{"read"}',
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(extension_id, user_id, oriva_group_id)
);

-- Indexes
CREATE INDEX idx_extension_group_permissions_extension_user 
ON extension_group_permissions(extension_id, user_id);
CREATE INDEX idx_extension_group_permissions_user 
ON extension_group_permissions(user_id);
CREATE INDEX idx_extension_group_permissions_group 
ON extension_group_permissions(oriva_group_id);
```

### 3. Extension Active Profiles
```sql
CREATE TABLE extension_active_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oriva_profile_id VARCHAR(255) NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(extension_id, user_id)
);

-- Indexes
CREATE INDEX idx_extension_active_profiles_extension_user 
ON extension_active_profiles(extension_id, user_id);
CREATE INDEX idx_extension_active_profiles_user 
ON extension_active_profiles(user_id);
```

## 🔒 **Security Implementation**

### 1. API Key Validation Middleware
```javascript
const validatePlatformAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const extensionId = req.headers['x-extension-id'];
    
    if (!apiKey || !extensionId) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key or extension ID'
      });
    }
    
    // Validate API key against internal registry
    const keyData = await validateAPIKey(apiKey);
    if (!keyData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }
    
    // Validate extension ID
    if (keyData.extension_id !== extensionId) {
      return res.status(401).json({
        success: false,
        error: 'Extension ID mismatch'
      });
    }
    
    req.keyData = keyData;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
```

### 2. Permission Validation Middleware
```javascript
const validateProfilePermission = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { extension_id } = req.keyData;
    
    // Check if extension has permission for this user
    const hasPermission = await checkProfilePermission(extension_id, userId);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Extension not authorized for this user'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
```

### 3. Data Sanitization Functions
```javascript
const sanitizeProfileData = (profile) => {
  return {
    oriva_profile_id: profile.id,
    profile_name: profile.name,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at
  };
};

const sanitizeGroupData = (group) => {
  return {
    oriva_group_id: group.id,
    group_name: group.name,
    member_count: group.member_count,
    is_active: group.is_active,
    created_at: group.created_at,
    updated_at: group.updated_at
  };
};

const sanitizeMemberData = (member) => {
  return {
    oriva_member_id: member.id,
    display_name: member.display_name,
    role: member.role,
    joined_at: member.joined_at
  };
};
```

## 🧪 **Testing Requirements**

### 1. Unit Tests
```javascript
describe('Profile Management API', () => {
  test('should return authorized profiles only', async () => {
    const response = await request(app)
      .get('/api/internal/profiles/user_123')
      .set('Authorization', 'Bearer valid_key')
      .set('X-Extension-ID', 'ext_123');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
  });
  
  test('should reject unauthorized access', async () => {
    const response = await request(app)
      .get('/api/internal/profiles/user_123')
      .set('Authorization', 'Bearer invalid_key')
      .set('X-Extension-ID', 'ext_123');
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
```

### 2. Integration Tests
```javascript
describe('Platform API Integration', () => {
  test('should work with Platform API endpoints', async () => {
    // Test the full flow from Platform API to Oriva Core
    const platformResponse = await request(platformApp)
      .get('/api/v1/profiles/available')
      .set('Authorization', 'Bearer oriva_pk_test_valid_key');
    
    expect(platformResponse.status).toBe(200);
    expect(platformResponse.body.data).toBeInstanceOf(Array);
  });
});
```

## 📊 **Performance Requirements**

### 1. Response Times
- Profile endpoints: < 200ms
- Group endpoints: < 300ms
- Permission endpoints: < 150ms

### 2. Caching Strategy
- Cache permission data for 5 minutes
- Cache profile/group data for 1 minute
- Invalidate cache on permission changes

### 3. Rate Limiting
- 1000 requests per minute per API key
- 100 requests per minute per extension-user pair

## 🚀 **Deployment Requirements**

### 1. Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_SIZE=20

# API Keys
PLATFORM_API_KEYS=key1,key2,key3

# Caching
REDIS_URL=redis://...
CACHE_TTL=300

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 2. Health Checks
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION
  });
});
```

### 3. Monitoring
- API response times
- Error rates
- Permission validation failures
- Database connection health

## 📋 **Implementation Checklist**

- [ ] Database schema created
- [ ] API endpoints implemented
- [ ] Authentication middleware
- [ ] Permission validation middleware
- [ ] Data sanitization functions
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Performance testing completed
- [ ] Security testing completed
- [ ] Documentation updated
- [ ] Health checks implemented
- [ ] Monitoring configured
- [ ] Deployment scripts ready

## 🎯 **Success Criteria**

1. **Functional**: All API endpoints work correctly
2. **Secure**: No data leakage or permission bypasses
3. **Performant**: Meets response time requirements
4. **Reliable**: 99.9% uptime
5. **Maintainable**: Clean, well-documented code

---

**Next Steps**: Review these specifications with the Oriva Core team and begin implementation planning.
