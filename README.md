# 🚀 Oriva Platform API

> **Build powerful apps that extend the Oriva Core source code collaboration platform**

Oriva Core is a private source code collaboration platform where teams manage repositories, track issues, and collaborate on code. External developers can build apps that integrate with Oriva Core to provide additional functionality and enhance the development workflow.

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

## 🌟 What is Oriva Core?

Oriva Core is a comprehensive source code collaboration platform that provides:

- **Repository Management** - Git repositories with advanced collaboration features
- **Issue Tracking** - Project management and bug tracking
- **Code Review** - Pull request workflows and code quality tools
- **Team Collaboration** - User management, permissions, and team workflows
- **Marketplace** - Extensible platform for third-party integrations

## 🎯 Build Apps for Oriva

Create powerful integrations that extend Oriva's functionality:

### 🔧 **Development Tools**
- CI/CD pipeline integrations
- Code quality and security scanners
- Automated testing tools
- Deployment automation

### 📊 **Analytics & Reporting**
- Project metrics and insights
- Team productivity dashboards
- Code quality analytics
- Custom reporting tools

### 🔗 **Integrations**
- External service connections
- Notification systems
- Documentation generators
- Workflow automation

### 💬 **Messaging (Coming Soon)**
- Decentralized messaging system
- End-to-end encrypted communication
- Real-time messaging with WebSocket
- Cross-platform message delivery

### 🎨 **User Experience**
- Custom UI components
- Enhanced code editors
- Theme and customization tools
- Accessibility improvements

## 🚀 Quick Start

### 1. 📝 Register Your App

1. **Log into your [Oriva Core account](https://oriva.io)**
2. **Go to Settings** → **Developer Settings**
3. **Click "Create New App"** and fill in your app details
4. **Get your API credentials** (Client ID & Secret)
5. **Configure OAuth settings** and redirect URIs

### 2. 🛠️ Build Your Integration

Use our comprehensive API to build apps that integrate with Oriva:

```typescript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

const sdk = new OrivaPluginSDK({
  pluginId: 'your-plugin-id',
  version: '1.0.0',
  userId: 'user-id',
  permissions: ['entries:read', 'entries:write'],
  apiKey: process.env.ORIVA_API_KEY,
  baseUrl: process.env.ORIVA_API_URL,
});

// Access user repositories
const repos = await sdk.repositories.list({
  visibility: 'all',
  sort: 'updated'
});

// Create issues
const issue = await sdk.issues.create({
  repositoryId: 'repo-123',
  title: 'Bug in authentication',
  description: 'Users cannot log in with OAuth',
  labels: ['bug', 'high-priority']
});

// Manage pull requests
const pr = await sdk.pullRequests.create({
  repositoryId: 'repo-123',
  title: 'Fix authentication bug',
  head: 'feature/fix-auth',
  base: 'main',
  body: 'This PR fixes the OAuth authentication issue'
});
```

### 3. 📦 Publish to Marketplace

Submit your app to the Oriva marketplace:
- Complete app review process
- Set pricing and availability
- Provide documentation and screenshots
- Launch to Oriva users worldwide

## 🔗 API Endpoints

### 🏪 **Marketplace API**
```bash
GET    /api/v1/marketplace/apps              # Browse available apps
GET    /api/v1/marketplace/apps/:appId       # Get app details
POST   /api/v1/marketplace/apps/:appId/install # Install app
DELETE /api/v1/marketplace/apps/:appId/install # Uninstall app
GET    /api/v1/marketplace/installed         # User's installed apps
```

### 👨‍💻 **Developer API**
```bash
GET    /api/v1/developer/apps                # Your published apps
POST   /api/v1/developer/apps                # Create new app
PUT    /api/v1/developer/apps/:appId         # Update app
POST   /api/v1/developer/apps/:appId/submit  # Submit for review
GET    /api/v1/developer/apps/:appId/analytics # App usage analytics
```


### 📚 **Core Platform API**
```bash
GET    /api/v1/repositories                  # User repositories
POST   /api/v1/repositories                  # Create repository
GET    /api/v1/repositories/:id/issues       # Repository issues
POST   /api/v1/repositories/:id/issues       # Create issue
GET    /api/v1/repositories/:id/pull-requests # Pull requests
POST   /api/v1/repositories/:id/pull-requests # Create pull request
GET    /api/v1/user/profile                  # User profile
GET    /api/v1/teams                         # User teams
```

## 🔐 Authentication

### API Key Authentication

```bash
# Use your API key in the Authorization header
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.io/api/v1/repositories
```

### Available Scopes

| Scope | Description |
|-------|-------------|
| `read:public-repositories` | Access public repositories only |
| `read:issues` | Read issues and comments |
| `write:issues` | Create and update issues |
| `read:pull-requests` | Read pull requests |
| `write:pull-requests` | Create and update pull requests |
| `read:notifications` | Read user notifications |
| `write:notifications` | Mark notifications as read |
| `app:data:read` | Read app-specific data (tables you create) |
| `app:data:write` | Write app-specific data (tables you create) |

## 💻 SDK Usage

### Install the SDK

```bash
npm install @oriva/plugin-sdk
```

### Basic Usage

```typescript
import { OrivaPluginSDK } from '@oriva/plugin-sdk';

const sdk = new OrivaPluginSDK({
  pluginId: 'your-plugin-id',
  version: '1.0.0',
  userId: 'user-id',
  permissions: ['entries:read', 'entries:write'],
  apiKey: process.env.ORIVA_API_KEY,
  baseUrl: process.env.ORIVA_API_URL,
});

// Get user's repositories
const repositories = await sdk.repositories.list({
  visibility: 'all',
  sort: 'updated',
  per_page: 20
});

// Create a new issue
const issue = await sdk.issues.create({
  repositoryId: 'repo-123',
  title: 'Feature Request: Dark Mode',
  description: 'Add dark mode support to the code editor',
  labels: ['enhancement', 'ui']
});

// Get pull requests
const pullRequests = await sdk.pullRequests.list({
  repositoryId: 'repo-123',
  state: 'open',
  sort: 'created'
});
```

### React Integration

```typescript
import { useOrivaSDK } from '@oriva/plugin-sdk/react';

function MyOrivaApp() {
  const { sdk, user, loading } = useOrivaSDK();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>You have {user.public_repos} public repositories</p>
    </div>
  );
}
```

## 🧪 Development & Testing

For development setup and testing strategies, see the [Quick Start Guide](docs/QUICKSTART.md).


## 📊 Rate Limits & Usage

### API Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 5,000 requests | Per hour |
| **OAuth** | 100 requests | Per hour |
| **Marketplace** | 1,000 requests | Per hour |
| **Webhooks** | 10,000 requests | Per hour |

### Usage Analytics

Track your app's performance:
- **API Usage**: Monitor request volume and response times
- **User Engagement**: Track app installations and usage
- **Error Rates**: Monitor API errors and failures
- **Performance Metrics**: Response times and availability

## 📋 App Categories

Build apps in these categories:

| Category | Description | Examples |
|----------|-------------|----------|
| **🔧 Development** | Code quality, testing, CI/CD | Linters, test runners, deployment tools |
| **📊 Analytics** | Metrics, reporting, insights | Code quality dashboards, team analytics |
| **🔗 Integrations** | External service connections | Slack notifications, Jira sync, email alerts |
| **🎨 UI/UX** | Interface enhancements | Themes, custom editors, accessibility tools |
| **📚 Documentation** | Docs generation, wikis | Auto-docs, knowledge bases, tutorials |
| **🛡️ Security** | Security scanning, compliance | Vulnerability scanners, audit tools |
| **⚡ Automation** | Workflow automation | Auto-merge, branch management, notifications |

## 🛠️ Development Resources

### Documentation
- **API Reference**: [OpenAPI Specification](https://github.com/0riva/oriva-platform/blob/main/docs/openapi.yml)
- **SDK Documentation**: [Plugin SDK](https://github.com/0riva/oriva-platform/tree/main/packages/plugin-sdk)
- **OAuth Guide**: [GitHub Repository](https://github.com/0riva/oriva-platform) (coming soon)
- **Webhooks**: [GitHub Repository](https://github.com/0riva/oriva-platform) (coming soon)

### Developer Tools
- **Interactive API Docs**: [https://api.oriva.io/docs](https://api.oriva.io/docs)
- **GraphQL Playground**: [https://api.oriva.io/graphql](https://api.oriva.io/graphql)
- **Developer Portal**: Use the developer settings within Oriva Core
- **Status Page**: [https://status.oriva.io](https://status.oriva.io)

### Community
- **Developer Discord**: [https://discord.gg/oriva-developers](https://discord.gg/oriva-developers)
- **GitHub Discussions**: [https://github.com/0riva/oriva-platform/discussions](https://github.com/0riva/oriva-platform/discussions)
- **Blog**: [https://blog.oriva.io](https://blog.oriva.io)

## 🆘 Support

### Getting Help
- **📧 Support**: Use the support system within Oriva Core
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/0riva/oriva-platform/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)

### Documentation Issues
- **📖 API Docs**: [Report documentation issues](https://github.com/0riva/oriva-platform/issues)
- **🔧 SDK Issues**: [Plugin SDK issues](https://github.com/0riva/oriva-platform/issues)
- **📚 General Questions**: [GitHub Discussions](https://github.com/0riva/oriva-platform/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions to improve the Oriva Platform API and SDK:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes and test**: `npm test`
4. **Commit changes**: `git commit -m 'Add amazing feature'`
5. **Push to branch**: `git push origin feature/amazing-feature`
6. **Open Pull Request**

### 🚀 **Special Call for Contributors: Decentralized Messaging**

We're building a **decentralized messaging system** and need your help! We're looking for contributors with expertise in:

- **WebSocket & Real-time Communication**
- **End-to-end Encryption & Cryptography**
- **WebRTC & Peer-to-peer Networking**
- **Message Queuing & Delivery Systems**

**Ready to help build the future of decentralized messaging?** Check out our [Contributing Guide](CONTRIBUTING.md#-decentralized-messaging-system) for details!

### Development Guidelines
- Follow TypeScript strict mode
- Add tests for new features
- Update documentation
- Follow existing code style
- Add appropriate error handling

---

**Built with ❤️ by the Oriva Team**

Ready to build the next generation of development tools? Get started with the Oriva Platform API today!