# Oriva Platform API - Overview

> **Comprehensive overview of the Oriva Platform API architecture, endpoints, and systems**

## 🎯 **API Overview**

### **Core Architecture**
Your Oriva Platform API is a **plugin-based system** designed to extend Oriva Core's functionality. It's built as a RESTful API gateway that provides secure access to Oriva's core features through a comprehensive plugin SDK.

### **Key Architectural Decisions**

1. **Plugin-First Architecture**: The entire system is designed around plugins that can extend Oriva Core functionality
2. **Security-First Design**: Implements granular permission system with app data isolation
3. **TypeScript-First SDK**: Full TypeScript support with comprehensive type definitions
4. **Multi-Platform Support**: Web, iOS, Android compatibility through unified SDK

---

## 🔌 **Existing API Endpoints/Services**

### **Core API Services**

#### **1. Entry Management API** (`/api/v1/entries`)
- **CRUD Operations**: Create, read, update, delete entries
- **Advanced Features**: 
  - Section management (add, update, delete, reorder)
  - Publishing workflow (draft → scheduled → published)
  - Full-text search capabilities
  - Entry statistics and analytics
- **Filtering**: By status, audience, template, search terms
- **Pagination**: Built-in pagination support

#### **2. Template System API** (`/api/v1/templates`)
- **Template Management**: Create, update, delete custom templates
- **Template Features**:
  - Category-based organization
  - Rating and usage tracking
  - Template duplication
  - Section management within templates
- **Discovery**: Popular templates, top-rated templates, search functionality

#### **3. User Management API** (`/api/v1/user`)
- **Profile Management**: Update user profiles, avatars
- **Preferences**: Plugin-scoped user preferences
- **Activity Tracking**: User activity summaries
- **Plugin Management**: Installed plugins, permissions checking

#### **4. UI Interaction API** (`/api/v1/ui`)
- **Notifications**: Show/hide notifications with different types
- **Modals**: Display modal dialogs, confirmations, alerts, prompts
- **Navigation**: Screen navigation, URL opening, back navigation
- **Menu Integration**: Add/remove custom menu items
- **Platform Features**: Haptic feedback, loading indicators, title management

#### **5. Plugin Storage API** (`/api/v1/storage`)
- **Data Persistence**: Plugin-specific data storage
- **Advanced Operations**: 
  - Atomic operations (increment, decrement, push, pull)
  - TTL support for temporary data
  - Batch operations (setMany, deleteMany)
- **Storage Management**: Usage statistics, quota management

### **🔒 Privacy-First API Services**

#### **6. Multi-Profile Management API** (`/api/v1/profiles`)
- **Privacy-Protected Profile Access**: Complete ID sanitization with `ext_` prefixes
- **User-Controlled Authorization**: Users explicitly authorize which profiles each extension can access
- **Profile Switching**: Secure context switching between authorized profiles
- **Data Isolation**: Each profile appears as completely separate entity to extensions
- **Cross-Profile Protection**: Extensions cannot determine if profiles belong to same user

#### **7. Group Management API** (`/api/v1/groups`)
- **Privacy-Protected Group Access**: Sanitized group IDs with `ext_` prefixes
- **Member Data Sanitization**: All member IDs use `ext_member_` prefix with no internal identifiers
- **Display Names Only**: Only display names shown, no usernames or internal identifiers
- **Role-Based Access**: Only necessary role information exposed
- **User Authorization**: Each group requires explicit user permission per extension

#### **8. Marketplace API** (`/api/v1/marketplace`)
- **App Discovery**: Browse, search, and filter marketplace apps
- **Trending & Featured**: Get trending and featured app collections
- **Category Management**: Browse apps by category with usage statistics
- **App Details**: Comprehensive app information with version history

#### **9. Developer API** (`/api/v1/developer`)
- **App Management**: Create, update, delete, and manage developer apps
- **Review Process**: Submit apps for review and handle approval workflow
- **Analytics**: Track app usage, installations, and performance metrics
- **Version Control**: Manage app versions and release notes

---

## 🔐 **Authentication & Plugin Systems**

### **Authentication Methods**
1. **API Key Authentication**: `Authorization: Bearer <api-key>` with Supabase validation
2. **Admin Token**: `X-Admin-Token: <admin-token>` for developer endpoints
3. **Usage Tracking**: Automatic API key usage statistics and monitoring

### **Permission System**
The platform uses a **granular permission system** with these scopes:

#### **Content Management**
- `entries:read` - Read user entries
- `entries:write` - Create and update entries
- `entries:delete` - Delete entries
- `templates:read` - Read templates
- `templates:write` - Create and update templates

#### **User & Profile Access**
- `user:read` - Read user information
- `user:write` - Update user information
- `profiles:read` - Read authorized user profiles
- `profiles:write` - Switch between authorized profiles

#### **Group Management**
- `groups:read` - Read user group memberships
- `groups:write` - Access group member information

#### **UI Interactions**
- `ui:notifications` - Show notifications
- `ui:modals` - Display modals
- `ui:navigation` - Navigate between screens

#### **Data Storage**
- `storage:read` - Read app-specific data
- `storage:write` - Write app-specific data

### **Security Model**
- **Privacy-First Design**: Complete ID sanitization with `ext_` prefixes prevents internal data exposure
- **User-Controlled Authorization**: Users explicitly authorize which profiles/groups each extension can access
- **Data Isolation**: Apps can only access their own data and authorized user profiles/groups
- **Cross-Profile Protection**: Extensions cannot determine if profiles belong to the same user
- **Permission Validation**: All endpoints validate required permissions with comprehensive error handling
- **Audit Logging**: Comprehensive security audit trails with Winston-based structured logging
- **Rate Limiting**: Global and per-extension rate limiting with configurable limits
- **Input Validation**: Comprehensive request validation and sanitization with express-validator

---

## 🏗️ **Key Architectural Decisions**

### **1. Plugin SDK Architecture**
- **Modular Design**: Separate API classes for different functionalities
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Robust error handling with retry logic and exponential backoff
- **Rate Limiting**: Built-in rate limiting with different limits per operation type

### **2. Security-First Design**
- **App Data Isolation**: Each app has its own isolated data storage
- **Public Repository Only**: Apps can only access public repositories
- **Permission-Based Access**: Granular permission system for all operations
- **Audit Logging**: All security-sensitive operations are logged

### **3. Multi-Platform Support**
- **Unified SDK**: Single SDK works across web, iOS, and Android
- **Platform-Specific Features**: Haptic feedback, navigation, etc.
- **Responsive Design**: UI components adapt to different platforms

### **4. Developer Experience**
- **Comprehensive Documentation**: OpenAPI spec, quickstart guide, examples
- **TypeScript Support**: Full type safety and IntelliSense support
- **Validation Tools**: Manifest validation, version compatibility checking
- **Testing Support**: Sandbox environment for development

### **5. Performance & Scalability**
- **Rate Limiting**: Different limits for different operation types
- **Caching**: Built-in caching for frequently accessed data
- **Pagination**: Efficient pagination for large datasets
- **Retry Logic**: Automatic retry with exponential backoff

---

## 📊 **Rate Limiting**

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 1,000 requests | Per 15 minutes |
| **Marketplace** | 1,000 requests | Per hour |
| **Admin Endpoints** | 30 requests | Per minute |
| **Webhooks** | 10,000 requests | Per hour |

---

## 🚀 **Current Status & Roadmap**

### **Current Implementation Status**
- ✅ **Core API Endpoints**: Fully implemented and documented
- ✅ **Privacy-First Features**: Complete ID sanitization and user-controlled permissions
- ✅ **Multi-Profile Management**: Secure profile switching with data isolation
- ✅ **Group Management**: Privacy-protected group access with sanitized member data
- ✅ **Marketplace API**: Complete app discovery and management system
- ✅ **Developer API**: Full app lifecycle management with review process
- ✅ **Security Model**: Production-ready security with rate limiting and audit logging
- ✅ **Plugin SDK**: Complete TypeScript SDK with all APIs
- ✅ **Documentation**: Comprehensive OpenAPI spec and guides
- ✅ **Testing**: 70 passing tests with comprehensive coverage

### **Upcoming Features (2025 Roadmap)**

#### **Q1 2025: Foundation & Security**
- 🔒 Security audit of existing API endpoints
- 📊 Analytics dashboard for API usage
- 🔐 Enhanced authentication with MFA support
- 📈 Rate limiting improvements with dynamic scaling

#### **Q2 2025: Developer Experience**
- 🛠️ SDK improvements with better TypeScript support
- 📚 Interactive API documentation with live examples
- 🧪 Testing framework for API integrations
- 🔧 Developer tools and debugging utilities
- 📱 Mobile SDKs for iOS and Android

#### **Q3 2025: Advanced Features**
- 💬 **Decentralized messaging system** (Major feature)
- 🔍 Advanced search capabilities with AI-powered results
- 📊 Real-time analytics and insights
- 🔄 Webhook system for event notifications
- 🌐 GraphQL API for flexible data querying

#### **Q4 2025: Scale & Performance**
- ⚡ Performance optimization for high-volume usage
- 🌍 Global CDN for worldwide low-latency access
- 📈 Auto-scaling infrastructure for demand spikes
- 🔒 Enterprise security features (SSO, audit logs)
- 📊 Advanced monitoring and alerting

---

## 🛠️ **Technical Stack**

### **Backend**
- **API Gateway**: RESTful API with OpenAPI 3.0 specification
- **Database**: PostgreSQL for primary data storage
- **Caching**: Redis for theme caching and session management
- **File Storage**: Theme assets and widget bundles

### **Frontend SDK**
- **Language**: TypeScript with full type definitions
- **HTTP Client**: Axios with interceptors for error handling
- **Platform Support**: Web, iOS, Android
- **Package Manager**: npm with comprehensive package.json

### **Security**
- **Authentication**: OAuth 2.0 with JWT tokens
- **Authorization**: Granular permission system
- **Data Isolation**: App-specific data storage
- **Audit Logging**: Comprehensive security audit trails

---

## 📚 **Documentation & Resources**

### **Available Documentation**
- **OpenAPI Specification**: Complete API documentation in `docs/openapi.yml`
- **Start Guide**: Developer onboarding in `docs/START_GUIDE.md`
- **SDK Documentation**: TypeScript SDK usage in `packages/plugin-sdk/README.md`
- **Internal Documentation**: Architecture decisions and requirements

### **Development Resources**
- **Production API**: `https://api.oriva.io`
- **Local Development**: `http://localhost:3001`

---

## 🎯 **Success Metrics**

### **Developer Adoption**
- **API usage growth**: 200% year-over-year target
- **Active developers**: 10K+ by end of 2025
- **Apps built**: 500+ by end of 2025
- **SDK downloads**: 100K+ per month

### **Platform Performance**
- **API uptime**: 99.99% availability target
- **Response time**: <100ms (95th percentile)
- **Throughput**: 1M+ requests per day
- **Error rate**: <0.1%

---

## 🔗 **Quick Links**

- **GitHub Repository**: [oriva-platform](https://github.com/0riva/oriva-platform)
- **API Documentation**: [OpenAPI Spec](docs/openapi.yml)
- **Developer Guide**: [Start Guide](docs/START_GUIDE.md)
- **Plugin SDK**: [@oriva/plugin-sdk](packages/plugin-sdk/)

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Production Ready
