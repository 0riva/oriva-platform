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

> **📖 New to Oriva?** Start with our comprehensive **[Developer Start Guide](docs/START_GUIDE.md)** for step-by-step setup instructions!

Ready to build your first Oriva integration? Follow our comprehensive [Start Guide](docs/START_GUIDE.md) to:

- 📝 **[Register your app](docs/START_GUIDE.md#-step-1-register-your-app)** with the Oriva platform
- 🔐 **[Set up authentication](docs/START_GUIDE.md#-step-2-set-up-authentication)** and API access
- 🛠️ **[Build your integration](docs/START_GUIDE.md#-step-3-install-and-use-the-sdk)** using our SDK
- 📦 **[Publish to marketplace](docs/START_GUIDE.md#-step-4-publish-to-marketplace)** and reach users worldwide

**[🚀 Get Started Now →](docs/START_GUIDE.md)**

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

Oriva uses API key authentication for secure access to the platform APIs.

## 💻 SDK

The Oriva Plugin SDK provides a TypeScript interface for building integrations with React hooks and comprehensive APIs.

## 🧪 Development & Testing

For development setup and testing strategies, see the [Start Guide](docs/START_GUIDE.md).


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
- **🚀 [Developer Start Guide](docs/START_GUIDE.md)** - Complete setup and integration guide
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
- **🚀 [Start Guide](docs/START_GUIDE.md)**: Complete setup and integration instructions
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