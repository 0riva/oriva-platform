# 🤝 Contributing to Oriva Platform API

> **Thank you for your interest in contributing to the Oriva Platform API!**

This comprehensive guide provides everything you need to know about contributing to the **Oriva Platform API** - the open-source API platform that enables developers to build integrations with the Oriva Core source code collaboration platform. Whether you're fixing bugs, adding features, or improving documentation, we welcome your contributions!

> **📝 Note:** This repository contains the **API platform** for building Oriva Core integrations. Oriva Core itself is in a separate private repository.

[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-blue)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)]()

---

## 🎯 What You Can Contribute To

### ✅ **API Platform (This Repository)**
- **API endpoints** and functionality
- **SDK improvements** and new features
- **Documentation** and examples
- **Bug fixes** and performance improvements
- **Testing** and quality assurance
- **🚀 Decentralized messaging system** (see below for details)

### ❌ **Oriva Core (Private Repository)**
- The core Oriva source code collaboration platform
- User interface and main application features
- Internal business logic and workflows

---

## 🚀 Decentralized Messaging System

We're excited to announce that we're planning to add **decentralized messaging capabilities** to the Oriva Platform API! This will enable developers to build messaging features that work across the Oriva ecosystem.

## 🎨 Widget Components Library & Theming System

We're also building a **comprehensive widget components library** with an advanced theming and skinning system! This will enable developers to create specialized interfaces for different types of work and research.

### 🎯 **Messaging Vision**

Create a robust, decentralized messaging system that allows:
- **Cross-platform communication** between Oriva apps
- **End-to-end encryption** for secure messaging
- **Message persistence** and synchronization
- **Real-time delivery** with WebSocket support
- **Message threading** and conversation management

### 🎨 **Theming System Vision**

Create a flexible theming and skinning system that enables:
- **Specialized work interfaces** for different types of research and development
- **Custom theme creation** by developers and designers
- **User theme adoption** based on their workflow preferences
- **Team standardization** on specific themes for organizations
- **Accessibility-focused themes** for inclusive design

### 🛠️ **Messaging Technical Approach**

The messaging system will be built on:
- **Decentralized architecture** - no single point of failure
- **WebRTC** for peer-to-peer connections
- **WebSocket** for real-time communication
- **End-to-end encryption** using modern cryptographic standards
- **Message relay nodes** for offline message delivery

### 🎨 **Theming System Technical Approach**

The theming system will include:
- **CSS-in-JS architecture** with design tokens and CSS variables
- **Component variants** that adapt to different themes
- **Theme inheritance** - base themes that can be extended
- **Dynamic theme switching** at runtime
- **Theme validation** to ensure compatibility across components
- **Live preview** system for theme development

### 🤝 **How to Contribute**

#### **For Messaging System:**
We're looking for contributors with expertise in:

**Backend Development**
- **WebSocket implementation** and real-time communication
- **Message queuing** and delivery systems
- **Database design** for message persistence
- **API design** for messaging endpoints

**Cryptography & Security**
- **End-to-end encryption** implementation
- **Key management** and distribution
- **Message authentication** and integrity
- **Privacy-preserving** protocols

**Frontend & SDK**
- **JavaScript/TypeScript SDK** for messaging
- **React hooks** for real-time messaging
- **Message UI components** and chat interfaces
- **WebRTC integration** for peer-to-peer

**Infrastructure & DevOps**
- **Message relay node** deployment and management
- **Load balancing** for high-volume messaging
- **Monitoring** and analytics for message delivery
- **Security auditing** and penetration testing

#### **For Theming System:**
We're looking for contributors with expertise in:

**Frontend Development**
- **React component libraries** and design systems
- **CSS-in-JS** and styling architectures
- **Design tokens** and theme management
- **Component composition** and variant systems

**Design & UX**
- **UI/UX design** for specialized work interfaces
- **Accessibility design** and inclusive interfaces
- **Design system** creation and maintenance
- **User research** for workflow optimization

**Theme Development**
- **Theme creation** tools and builders
- **CSS architecture** and best practices
- **Performance optimization** for theme switching
- **Cross-browser compatibility** testing

**Documentation & Examples**
- **Component documentation** with Storybook
- **Theme showcase** and gallery
- **Integration examples** and tutorials
- **Developer onboarding** materials

#### **Infrastructure & DevOps**
- **Message relay node** deployment
- **Load balancing** for high availability
- **Monitoring** and analytics
- **Performance optimization**

### 📋 **Getting Started**

1. **Join the discussion** in [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)
2. **Check out the planning document** (coming soon)
3. **Start with small contributions** - documentation, tests, or bug fixes
4. **Propose your ideas** for the messaging architecture

### 🎉 **Why This Matters**

Decentralized messaging will:
- **Enable new app categories** - chat apps, collaboration tools, notification systems
- **Improve user experience** - seamless communication across Oriva apps
- **Enhance privacy** - end-to-end encryption and decentralized architecture
- **Foster innovation** - developers can build unique messaging experiences

---

## 🚀 Getting Started

### 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** - JavaScript runtime
- **PostgreSQL with pgvector extension** - Database
- **Git** - Version control
- **GitHub account** - For collaboration

### 🛠️ Development Setup

Follow these steps to set up your development environment:

#### **1. Fork & Clone**
```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/oriva-platform.git
cd oriva-platform
```

#### **2. Add Upstream Remote**
```bash
git remote add upstream https://github.com/0riva/oriva-platform.git
```

#### **3. Install Dependencies**
```bash
cd api && npm install
```

#### **4. Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

#### **5. Database Setup**
```bash
# Run database migrations (apply SQL files in api/sql/)
# Database setup completed automatically
```

#### **6. Start Development Server**
```bash
npm run dev
```

> **🎉 Success!** Your development environment is now ready!

---

## 📋 Development Workflow

### 🌳 Branch Strategy

We follow the **Git Flow** branching model:

| Branch Type | Purpose | Example |
|-------------|---------|---------|
| `main` | Production-ready code | `main` |
| `develop` | Integration branch for features | `develop` |
| `feature/feature-name` | Individual feature development | `feature/user-authentication` |
| `bugfix/bug-description` | Bug fixes | `bugfix/login-error` |
| `hotfix/critical-fix` | Critical production fixes | `hotfix/security-patch` |

### 🔄 Making Changes

#### **1. Create a Feature Branch**
```bash
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

#### **2. Make Your Changes**
Follow our coding standards and best practices outlined below.

#### **3. Test Your Changes**
```bash
npm test          # Run tests
npm run lint      # Check code style
npm run build     # Verify build
```

#### **4. Commit Your Changes**
```bash
git add .
git commit -m "feat: add amazing new feature

- Detailed description of what was added
- Why this change was necessary
- Any breaking changes or migration notes"
```

#### **5. Push to Your Fork**
```bash
git push origin feature/your-feature-name
```

#### **6. Create a Pull Request**
Open a PR on GitHub with a clear description of your changes.

---

## 📝 Coding Standards

### 🔷 TypeScript Guidelines

We follow strict TypeScript practices to ensure code quality and maintainability:

| Rule | Description | Example |
|------|-------------|---------|
| **Strict Mode** | Follow TypeScript strict rules | `"strict": true` in tsconfig |
| **Explicit Types** | Avoid `any`, use specific types | `string` instead of `any` |
| **Interface over Type** | Prefer interfaces for object shapes | `interface UserProfile` |
| **Consistent Naming** | camelCase for variables, PascalCase for classes | `getUserProfile`, `UserService` |

#### **✅ Good Examples**
```typescript
interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
}

const getUserProfile = async (userId: string): Promise<UserProfile> => {
  // Implementation
};
```

#### **❌ Avoid These Patterns**
```typescript
const getUser = async (id: any): Promise<any> => {
  // Implementation
};
```

### 🌐 API Guidelines

Our API follows RESTful principles with consistent patterns:

| Principle | Description | Example |
|-----------|-------------|---------|
| **RESTful Design** | Follow REST principles | `GET /api/v1/users` |
| **Consistent Responses** | Use standardized response format | See format below |
| **Proper HTTP Codes** | Use appropriate status codes | `200`, `400`, `404`, `500` |
| **Input Validation** | Validate all inputs with Joi schemas | `Joi.object({...})` |

#### **✅ Standard Response Format**
```typescript
{
  "data": { /* actual data */ },
  "success": true,
  "meta": {
    "pagination": { /* pagination info */ }
  }
}
```

#### **❌ Inconsistent Format**
```typescript
{
  "users": [ /* data */ ],
  "count": 10,
  "page": 1
}
```

### 🚨 Error Handling

We follow consistent error handling patterns:

| Practice | Description | Example |
|----------|-------------|---------|
| **Consistent Format** | Use standardized error responses | See format below |
| **Proper Logging** | Log errors with context | `logger.error('message', { context })` |
| **User-Friendly Messages** | Don't expose internal errors | Generic messages for users |

#### **✅ Good Error Handling**
```typescript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new APIError('Operation failed', 500);
}
```

### 🧪 Testing Requirements

We maintain high code quality through comprehensive testing:

| Test Type | Coverage | Purpose |
|-----------|----------|---------|
| **Unit Tests** | Individual functions | Test logic in isolation |
| **Integration Tests** | API endpoints | Test end-to-end flows |
| **Coverage Target** | >80% code coverage | Ensure thorough testing |
| **Mock External Services** | No real API calls | Isolate tests from dependencies |

---

## 🧪 Testing

### 🏃‍♂️ Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode  
npm run test:watch

# Run specific test file
npm test -- routes/marketplace.test.ts
```

### ✍️ Writing Tests

#### **API Endpoint Test Example**
```typescript
describe('GET /api/v1/marketplace/apps', () => {
  it('should return list of published apps', async () => {
    const response = await request(app)
      .get('/api/v1/marketplace/apps')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should handle authentication errors', async () => {
    const response = await request(app)
      .get('/api/v1/marketplace/installed')  // Requires auth
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('authentication');
  });
});
```

## 📖 Documentation

### Code Documentation

- **JSDoc comments** for public APIs
- **Inline comments** for complex logic
- **README updates** for significant changes
- **OpenAPI spec** updates for API changes

```typescript
/**
 * Creates a new marketplace app
 * @param appData - The app data to create
 * @param developerId - ID of the developer creating the app
 * @returns Promise resolving to created app
 * @throws {ValidationError} When app data is invalid
 * @throws {AuthorizationError} When developer lacks permissions
 */
export async function createApp(
  appData: CreateAppData,
  developerId: string
): Promise<MarketplaceApp> {
  // Implementation
}
```

### API Documentation

- Update `openapi.yml` for API changes
- Include examples in documentation
- Document error responses
- Keep documentation in sync with implementation

## 🔍 Pull Request Process

### PR Requirements

- [ ] **Tests added/updated** for changes
- [ ] **Documentation updated** if needed
- [ ] **No linting errors** (`npm run lint` passes)
- [ ] **All tests pass** (`npm test` passes)
- [ ] **Build succeeds** (`npm run build` passes)
- [ ] **Security review** for sensitive changes
- [ ] **Breaking changes documented** in PR description

### PR Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review performed
- [ ] Documentation updated
- [ ] Tests added and passing
- [ ] No new warnings introduced
```

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** - Check if bug already reported
2. **Test with latest version** - Ensure bug exists in current version
3. **Minimal reproduction** - Create smallest example that demonstrates bug

### Bug Report Template

```markdown
**Bug Description**
Clear, concise description of the bug.

**Reproduction Steps**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What you expected to happen.

**Actual Behavior** 
What actually happened.

**Environment**
- OS: [e.g. macOS 12.0]
- Node.js version: [e.g. 18.17.0]
- API version: [e.g. 1.0.0]

**Additional Context**
Any other context, screenshots, logs, etc.
```

## 💡 Feature Requests

### Before Requesting

1. **Check roadmap** - See if feature already planned
2. **Search discussions** - Check if feature already discussed
3. **Consider scope** - Ensure feature fits project goals

### Feature Request Template

```markdown
**Feature Summary**
Brief description of the feature.

**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Any other context, mockups, examples, etc.
```

## 🔐 Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email security@oriva.io with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll acknowledge within 24 hours and provide a timeline for fixes.

### Security Guidelines

- **Input validation** - Validate all user inputs
- **Authentication** - Secure all protected endpoints
- **Authorization** - Check permissions properly
- **Secrets management** - Never commit secrets
- **SQL injection prevention** - Use parameterized queries
- **XSS prevention** - Sanitize outputs properly

## 📞 Getting Help

### Communication Channels

- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Discord** - Real-time community chat
- **Email** - Direct contact for sensitive issues

### Response Times

- **Critical bugs** - Within 24 hours
- **General issues** - Within 72 hours  
- **Feature requests** - Within 1 week
- **PRs** - Within 1 week

## 🎯 Project Vision

The Oriva Platform aims to be the most developer-friendly social platform API, enabling:

- **Easy integration** - Simple, well-documented APIs
- **Powerful features** - Rich social and marketplace functionality  
- **Scalable architecture** - Handle millions of users and apps
- **Developer success** - Tools and support for app creators

## 📄 License

By contributing to Oriva Platform, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Oriva Platform!** 🎉

Every contribution, no matter how small, helps make the platform better for developers and users worldwide.