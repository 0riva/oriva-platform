# 🚀 Oriva Platform API

> **Build powerful apps that extend the Oriva Core source code collaboration platform**

Oriva is a collaboration network. External developers can build apps that integrate with Oriva Core to provide additional functionality via the Oriva Platform.

[![API Version](https://img.shields.io/badge/API-v1.0-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

## 🌟 What is Oriva Core?

Oriva is a collaboration platform for modern human to human coordination. Learn more at [https://oriva.io](https://oriva.io).

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

- 📝 **Register your app** with the Oriva platform
- 🔐 **Set up authentication** and API access
- 🛠️ **Build your integration** using our SDK
- 📦 **Publish to marketplace** and reach users worldwide

**[🚀 Get Started Now →](docs/START_GUIDE.md)**

## 🔗 API Overview

The Oriva Platform provides comprehensive APIs for:

- **🏪 Marketplace** - Browse, install, and manage apps
- **👨‍💻 Developer** - Create, publish, and analyze your apps  
- **📚 Core Platform** - Access repositories, issues, pull requests, and user data
- **🔒 Privacy-First Features** - Multi-profile management with complete data isolation
- **👥 Group Management** - Secure group access with sanitized member data

[**View Complete API Reference →**](docs/START_GUIDE.md#api-endpoints)

## 🔐 Authentication & Privacy

Oriva uses **API key authentication** with **privacy-first design** for secure access to the platform APIs.

### 🔒 **Privacy-First Features**
- **Complete ID Sanitization** - All internal IDs are sanitized with `ext_` prefixes
- **User-Controlled Permissions** - Users explicitly authorize which profiles/groups each extension can access
- **Minimal Data Exposure** - Only display names and essential data, no personal information
- **Cross-Profile Protection** - Extensions cannot link profiles to the same user
- **Secure External IDs** - Configurable salt-based ID generation prevents internal data exposure

### 🔑 **API Key Authentication**
- **Bearer Token Format**: `Authorization: Bearer <api-key>`
- **Supabase Integration**: Real-time validation against database
- **Usage Tracking**: Automatic usage statistics and monitoring
- **Key Prefix Validation**: Supports `oriva_pk_live_` and `oriva_pk_test_` keys

## 💻 SDK

The Oriva Plugin SDK provides a TypeScript interface for building integrations with React hooks and comprehensive APIs.

## 🧪 Development & Testing

For development setup and testing strategies, see the [Start Guide](docs/START_GUIDE.md).


## 📊 Rate Limits & Usage

### API Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| **Core API** | 1,000 requests | Per 15 minutes |
| **Marketplace** | 1,000 requests | Per hour |
| **Webhooks** | 10,000 requests | Per hour |
| **Admin Endpoints** | 30 requests | Per minute |

> **Note:** Rate limits ensure fair usage and system stability. Limits apply per API key with comprehensive monitoring and logging.

### 🔒 **Security Features**
- **Rate Limiting**: Global and per-extension rate limiting
- **CORS Protection**: Origin validation with configurable allowed origins
- **Security Headers**: CSP, HSTS, and other security headers
- **Input Validation**: Comprehensive request validation and sanitization
- **Structured Logging**: Winston-based logging for security events and monitoring

### Usage Analytics

Track your app's performance:
- **API Usage**: Monitor request volume and response times
- **User Engagement**: Track app installations and usage
- **Error Rates**: Monitor API errors and failures
- **Performance Metrics**: Response times and availability

## 📋 App Categories

Build social apps for the Oriva network:

| Category | Description | Examples |
|----------|-------------|----------|
| **🏠 Private Groups** | Exclusive communities and interest-based groups | Book clubs, photography groups, local meetups |
| **🤝 Networking** | Professional and personal relationship building | Dating apps, LinkedIn alternatives, mentorship platforms |
| **📚 Learning** | Educational content and skill development | Online courses, study groups, certification programs |
| **🎮 Gaming** | Interactive entertainment and competitive play | Puzzle games, esports tournaments, virtual worlds |
| **🏥 Wellness** | Health, fitness, and mental well-being | Meditation apps, fitness tracking, therapy platforms |
| **🔧 Innovation** | Technology development and engineering | Code collaboration, hackathons, tech incubators |
| **💰 Finance** | Financial services and economic tools | Payment apps, investment platforms, budgeting tools |
| **💬 Messaging** | Peer-to-peer private communication | Encrypted chat, voice calls, secure file sharing |
| **🌐 Decentralization** | Blockchain and privacy-focused applications | DAOs, encrypted chat, decentralized social networks |

## 🛠️ Development Resources

### Documentation
- **🚀 [Developer Start Guide](docs/START_GUIDE.md)** - Complete setup and integration guide
- **🧪 [API Tester](docs/api-tester.html)** - Interactive tool to test Oriva Platform APIs
- **API Reference**: [OpenAPI Specification](https://github.com/0riva/oriva-platform/blob/main/docs/openapi.yml)
- **🔒 [Privacy Protection Guide](docs/PRIVACY_GUIDE.md)** - Comprehensive privacy-first development guide
- **🚀 [Deployment Management](DEPLOYMENT_MANAGEMENT.md)** - Best practices for API deployments
- **🎨 Components Library**: [Oriva UI Components](https://github.com/0riva/oriva-platform) (coming soon)
- **🎭 Theme System**: [Custom Themes Guide](https://github.com/0riva/oriva-platform) (coming soon)
- **🔌 Plugin SDK**: [Plugin SDK](https://github.com/0riva/oriva-platform/tree/main/packages/plugin-sdk)
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

**Made with 🪄 by the Oriva Team**

Ready to build the next generation of development tools? Get started with the Oriva Platform API today!