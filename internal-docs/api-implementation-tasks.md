# API Implementation Tasks - Secure App Data Model

> **Internal Task List - For Development Team**

## 📋 Document Information

- **Version**: 1.0
- **Date**: January 2025
- **Status**: Planning Phase
- **Owner**: Oriva Platform Team
- **Priority**: High

---

## 🎯 Overview

This document outlines the detailed implementation tasks required to update the Oriva Platform API to implement the new secure app data model where apps can only access their own data and public repository information.

---

## 🔒 Security Model Changes

### **Current State (Insecure)**
- Apps can access user profile data
- Apps can read/write user repositories
- Apps have broad permissions to core user data

### **Target State (Secure)**
- Apps can only access public repositories
- Apps can only read/write their own database tables
- Complete isolation from user profile data
- Granular permission system

---

## 📝 Implementation Tasks

### **Phase 1: Permission System Overhaul**

#### **Task 1.1: Update OAuth Scope Validation**
- **File**: `api/plugin-gateway/middleware/auth.js`
- **Description**: Update OAuth scope validation to reject old scopes
- **Details**:
  ```javascript
  // Remove these scopes:
  - user:read
  - user:write
  - entries:read
  - entries:write
  - templates:read
  - templates:write
  
  // Add these scopes:
  - read:public-repositories
  - read:issues
  - write:issues
  - read:pull-requests
  - write:pull-requests
  - read:notifications
  - write:notifications
  - app:data:read
  - app:data:write
  ```
- **Estimated Time**: 4 hours
- **Dependencies**: None

#### **Task 1.2: Create App Data Database Schema**
- **File**: `api/plugin-gateway/sql/migration_004_app_data_tables.sql`
- **Description**: Create database schema for app-specific data storage
- **Details**:
  ```sql
  -- App data tables
  CREATE TABLE app_data_tables (
    id UUID PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    schema_definition JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(app_id, table_name)
  );
  
  -- App data storage (dynamic tables)
  CREATE TABLE app_data_storage (
    id UUID PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  
  -- Indexes for performance
  CREATE INDEX idx_app_data_storage_app_table ON app_data_storage(app_id, table_name);
  CREATE INDEX idx_app_data_storage_created_at ON app_data_storage(created_at);
  ```
- **Estimated Time**: 2 hours
- **Dependencies**: None

#### **Task 1.3: Update Permission Middleware**
- **File**: `api/plugin-gateway/middleware/permissions.js`
- **Description**: Update permission checking middleware
- **Details**:
  ```javascript
  // Add new permission checks
  const checkAppDataPermission = (req, res, next) => {
    const { app_id } = req.plugin;
    const { table } = req.params;
    
    // Verify app owns this table
    if (!await appOwnsTable(app_id, table)) {
      return res.status(403).json({ error: 'Access denied to table' });
    }
    next();
  };
  
  const checkPublicRepositoryAccess = (req, res, next) => {
    const { repository_id } = req.params;
    
    // Verify repository is public
    if (!await isRepositoryPublic(repository_id)) {
      return res.status(403).json({ error: 'Private repository access denied' });
    }
    next();
  };
  ```
- **Estimated Time**: 6 hours
- **Dependencies**: Task 1.1

### **Phase 2: API Endpoint Updates**

#### **Task 2.1: Remove User Profile Endpoints**
- **Files**: 
  - `api/plugin-gateway/routes/user.js`
  - `api/plugin-gateway/controllers/userController.js`
- **Description**: Remove or secure user profile endpoints
- **Details**:
  ```javascript
  // Remove these endpoints:
  - GET /api/v1/user/profile
  - PUT /api/v1/user/profile
  - GET /api/v1/user/settings
  
  // Keep only public user info (username, avatar) for public repositories
  ```
- **Estimated Time**: 3 hours
- **Dependencies**: Task 1.1

#### **Task 2.2: Update Repository Endpoints**
- **Files**:
  - `api/plugin-gateway/routes/repositories.js`
  - `api/plugin-gateway/controllers/repositoryController.js`
- **Description**: Update repository endpoints to only access public repos
- **Details**:
  ```javascript
  // Update GET /api/v1/repositories
  const getPublicRepositories = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    // Only return public repositories
    const repositories = await db.query(`
      SELECT id, name, description, is_public, created_at, updated_at
      FROM repositories 
      WHERE is_public = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, (page - 1) * limit]);
    
    res.json({ repositories, pagination: { page, limit } });
  };
  ```
- **Estimated Time**: 4 hours
- **Dependencies**: Task 1.3

#### **Task 2.3: Create App Data Endpoints**
- **Files**:
  - `api/plugin-gateway/routes/appData.js` (new)
  - `api/plugin-gateway/controllers/appDataController.js` (new)
- **Description**: Create new endpoints for app-specific data access
- **Details**:
  ```javascript
  // GET /api/v1/app/data
  const getAppData = async (req, res) => {
    const { app_id } = req.plugin;
    const { table, page = 1, limit = 20 } = req.query;
    
    // Verify app owns this table
    if (!await appOwnsTable(app_id, table)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const data = await db.query(`
      SELECT data, created_at, updated_at
      FROM app_data_storage
      WHERE app_id = $1 AND table_name = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `, [app_id, table, limit, (page - 1) * limit]);
    
    res.json({ data, pagination: { page, limit } });
  };
  
  // POST /api/v1/app/data
  const createAppData = async (req, res) => {
    const { app_id } = req.plugin;
    const { table, data } = req.body;
    
    // Verify app owns this table
    if (!await appOwnsTable(app_id, table)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await db.query(`
      INSERT INTO app_data_storage (app_id, table_name, data)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `, [app_id, table, JSON.stringify(data)]);
    
    res.status(201).json({ id: result.rows[0].id });
  };
  ```
- **Estimated Time**: 8 hours
- **Dependencies**: Task 1.2, Task 1.3

#### **Task 2.4: Update Issue and PR Endpoints**
- **Files**:
  - `api/plugin-gateway/routes/issues.js`
  - `api/plugin-gateway/routes/pullRequests.js`
- **Description**: Ensure issue and PR endpoints only access public repositories
- **Details**:
  ```javascript
  // Add repository access check to all issue/PR endpoints
  const checkRepositoryAccess = async (req, res, next) => {
    const { repository_id } = req.params;
    
    if (!await isRepositoryPublic(repository_id)) {
      return res.status(403).json({ error: 'Private repository access denied' });
    }
    next();
  };
  ```
- **Estimated Time**: 3 hours
- **Dependencies**: Task 1.3

### **Phase 3: Database and Security Updates**

#### **Task 3.1: Create App Table Management**
- **File**: `api/plugin-gateway/services/appDataService.js` (new)
- **Description**: Create service for managing app-specific database tables
- **Details**:
  ```javascript
  class AppDataService {
    async createTable(appId, tableName, schema) {
      // Validate schema
      // Create table definition
      // Store in app_data_tables
    }
    
    async appOwnsTable(appId, tableName) {
      const result = await db.query(`
        SELECT id FROM app_data_tables 
        WHERE app_id = $1 AND table_name = $2
      `, [appId, tableName]);
      return result.rows.length > 0;
    }
    
    async isRepositoryPublic(repositoryId) {
      const result = await db.query(`
        SELECT is_public FROM repositories WHERE id = $1
      `, [repositoryId]);
      return result.rows[0]?.is_public === true;
    }
  }
  ```
- **Estimated Time**: 6 hours
- **Dependencies**: Task 1.2

#### **Task 3.2: Update Database Migrations**
- **File**: `api/plugin-gateway/sql/migration_005_remove_user_access.sql`
- **Description**: Remove old user access permissions and data
- **Details**:
  ```sql
  -- Remove old permission entries
  DELETE FROM plugin_permissions WHERE permission IN (
    'user:read', 'user:write', 'entries:read', 'entries:write',
    'templates:read', 'templates:write'
  );
  
  -- Add new permission entries
  INSERT INTO plugin_permissions (permission, description) VALUES
  ('read:public-repositories', 'Access public repositories only'),
  ('read:issues', 'Read issues and comments'),
  ('write:issues', 'Create and update issues'),
  ('read:pull-requests', 'Read pull requests'),
  ('write:pull-requests', 'Create and update pull requests'),
  ('read:notifications', 'Read user notifications'),
  ('write:notifications', 'Mark notifications as read'),
  ('app:data:read', 'Read app-specific data'),
  ('app:data:write', 'Write app-specific data');
  ```
- **Estimated Time**: 2 hours
- **Dependencies**: Task 1.1

#### **Task 3.3: Add Security Audit Logging**
- **File**: `api/plugin-gateway/middleware/audit.js` (new)
- **Description**: Add comprehensive audit logging for security
- **Details**:
  ```javascript
  const auditLog = (action, details) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      app_id: details.app_id,
      user_id: details.user_id,
      resource: details.resource,
      success: details.success,
      error: details.error
    };
    
    // Log to security audit table
    db.query(`
      INSERT INTO security_audit_log (log_entry)
      VALUES ($1)
    `, [JSON.stringify(logEntry)]);
  };
  ```
- **Estimated Time**: 4 hours
- **Dependencies**: None

### **Phase 4: Testing and Validation**

#### **Task 4.1: Create Security Tests**
- **File**: `api/plugin-gateway/tests/security.test.js` (new)
- **Description**: Create comprehensive security tests
- **Details**:
  ```javascript
  describe('Security Tests', () => {
    test('should deny access to private repositories', async () => {
      const response = await request(app)
        .get('/api/v1/repositories/private-repo-id')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(403);
    });
    
    test('should deny access to other app data', async () => {
      const response = await request(app)
        .get('/api/v1/app/data?table=other-app-table')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(403);
    });
    
    test('should deny user profile access', async () => {
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', 'Bearer valid-token');
      
      expect(response.status).toBe(404); // Endpoint removed
    });
  });
  ```
- **Estimated Time**: 8 hours
- **Dependencies**: All previous tasks

#### **Task 4.2: Update Integration Tests**
- **File**: `api/plugin-gateway/tests/integration.test.js`
- **Description**: Update existing integration tests for new security model
- **Details**:
  - Update all tests to use new permission scopes
  - Add tests for app data endpoints
  - Remove tests for user profile endpoints
  - Add tests for public repository access only
- **Estimated Time**: 6 hours
- **Dependencies**: Task 4.1

#### **Task 4.3: Performance Testing**
- **File**: `api/plugin-gateway/tests/performance.test.js` (new)
- **Description**: Test performance of new app data endpoints
- **Details**:
  - Load testing for app data queries
  - Performance testing for permission checks
  - Database query optimization validation
- **Estimated Time**: 4 hours
- **Dependencies**: Task 4.1

### **Phase 5: Documentation and Deployment**

#### **Task 5.1: Update API Documentation**
- **File**: `docs/openapi.yml` (already updated)
- **Description**: Ensure OpenAPI spec matches implementation
- **Details**:
  - Verify all endpoints are documented
  - Update examples to use new scopes
  - Add security requirements documentation
- **Estimated Time**: 2 hours
- **Dependencies**: All implementation tasks

#### **Task 5.2: Update SDK Documentation**
- **File**: `packages/plugin-sdk/README.md`
- **Description**: Update SDK documentation for new security model
- **Details**:
  - Update permission examples
  - Add app data usage examples
  - Remove user profile examples
- **Estimated Time**: 3 hours
- **Dependencies**: Task 5.1

#### **Task 5.3: Create Migration Guide**
- **File**: `docs/MIGRATION_GUIDE.md` (new)
- **Description**: Create guide for existing apps to migrate
- **Details**:
  - Step-by-step migration instructions
  - Breaking changes documentation
  - Code examples for new patterns
- **Estimated Time**: 4 hours
- **Dependencies**: Task 5.2

---

## 📊 Task Summary

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|----------------|--------------|
| **Phase 1** | Permission System | 12 hours | None |
| **Phase 2** | API Endpoints | 18 hours | Phase 1 |
| **Phase 3** | Database & Security | 12 hours | Phase 1 |
| **Phase 4** | Testing | 18 hours | All previous |
| **Phase 5** | Documentation | 9 hours | All previous |
| **Total** | **15 tasks** | **69 hours** | - |

---

## 🚨 Critical Security Considerations

### **Data Isolation**
- Apps must be completely isolated from user profile data
- App data tables must be scoped to app_id
- No cross-app data access allowed

### **Permission Validation**
- All endpoints must validate permissions
- Repository access must check public status
- App data access must verify ownership

### **Audit Logging**
- All security-sensitive operations must be logged
- Failed permission checks must be tracked
- Data access patterns must be monitored

---

## 🎯 Success Criteria

### **Security**
- ✅ No access to user profile data
- ✅ No access to private repositories
- ✅ Complete app data isolation
- ✅ All permission checks working

### **Functionality**
- ✅ App data endpoints working
- ✅ Public repository access working
- ✅ Issue/PR access working
- ✅ All tests passing

### **Performance**
- ✅ Permission checks < 10ms
- ✅ App data queries < 100ms
- ✅ No performance regression

---

## 📅 Timeline

### **Week 1**: Phase 1 (Permission System)
- Days 1-2: OAuth scope validation
- Days 3-4: Database schema and middleware

### **Week 2**: Phase 2 (API Endpoints)
- Days 1-2: Remove user endpoints, update repositories
- Days 3-4: Create app data endpoints
- Day 5: Update issue/PR endpoints

### **Week 3**: Phase 3 (Database & Security)
- Days 1-2: App data service
- Days 3-4: Migrations and audit logging

### **Week 4**: Phase 4 (Testing)
- Days 1-2: Security tests
- Days 3-4: Integration and performance tests

### **Week 5**: Phase 5 (Documentation)
- Days 1-2: API and SDK documentation
- Days 3-4: Migration guide and deployment

---

**Document Status**: Ready for Development

**Last Updated**: January 2025

**Next Review**: Weekly during implementation
