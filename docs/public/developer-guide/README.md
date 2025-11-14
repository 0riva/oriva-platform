# Oriva Platform Developer Documentation

**Security-first integration guides for third-party developers**

> **🆕 NEW: Comprehensive API Documentation**
> - **[API Overview](./API_OVERVIEW.md)** - 5-minute introduction
> - **[API User Guide](./API_USER_GUIDE.md)** - All ~37 public endpoints documented
> - **[API Patterns](./API_PATTERNS.md)** - Production-ready patterns
>
> *Clarifies authentication model: Oriva handles auth, your app uses API keys*
> *Human-friendly and AI-agent optimized for easy integration*

## 🚀 Quick Start

**New to Oriva Platform?** Choose your learning path:

### 🏃‍♂️ **Fast Track (Recommended for New Developers)**
1. **[5-Minute API Test](./5-minute-api-test.md)** - Verify your API key works
2. **[15-Minute Web App](./15-minute-web-app.md)** - Build a working integration
3. **[Production Deployment](../START_GUIDE.md#-production-deployment)** - Go live

### 🏗️ **Comprehensive Setup (For Production Apps)**
1. **[Complete Integration Guide](../START_GUIDE.md)** - Full marketplace integration
2. **[Authentication Patterns](./authentication-patterns.md)** - Secure auth implementation
3. **[API Reference](./api-reference-complete.md)** - Complete endpoint documentation

## 📚 Complete Documentation Index

### 🌟 **NEW: Comprehensive API Documentation**
- **[API Overview](./API_OVERVIEW.md)** - 📘 **5-minute introduction to the Oriva Platform API**
- **[API User Guide](./API_USER_GUIDE.md)** - 📖 **Complete guide with all ~37 public endpoints documented**
- **[API Patterns](./API_PATTERNS.md)** - 🔧 **Production-ready integration patterns and best practices**

**Key Update:** Clarifies that **Oriva handles authentication** - your app doesn't implement login/register, it uses API keys to access Oriva's authenticated users.

### 📖 Getting Started (Start Here!)
- **[Quick Start Guide](./quick-start.md)** - 15-minute integration with working code
- **[API Endpoints Index](./api-endpoints-index.md)** - Quick reference for endpoints
- **[Complete API Reference](./api-reference-complete.md)** - Legacy endpoint documentation

### 🛡️ Security & Authentication
- **[Authentication Patterns](./authentication-patterns.md)** - Secure authentication flows and session management
- **[SECURITY WARNING](./SECURITY-WARNING.md)** - Critical security alerts and vulnerable patterns to avoid
- **[Secure Iframe Integration](./iframe-integration-secure.md)** - Security-first iframe implementation

### 🔧 Development & Integration
- **[Secure Localhost Development](./SECURE-localhost-development.md)** - Production-ready development environment
- **[Migration Guide](./migration-guide-from-url-auth.md)** - Upgrade from URL-based to secure authentication
- **[API Headers Reference](./api-headers-reference.md)** - Complete header documentation with security best practices
- **[API Troubleshooting Guide](./api-troubleshooting-guide.md)** - Systematic debugging and issue resolution

## 🛡️ Security-First Approach

All documentation in this directory follows security-first principles:

### ✅ Secure Patterns We Teach
- **HTTP-only cookies** for authentication
- **Environment variables** for credential management
- **Server-side proxy patterns** for API calls
- **Complete environment isolation** (dev vs production)
- **Origin validation** for iframe communication
- **Proper error handling** without data exposure

### ❌ Insecure Patterns We Prevent
- JWT tokens in URLs or localStorage
- Production database access from development
- Hardcoded credentials in code
- Unvalidated message origins
- Client-side API key exposure

## 🎯 Integration Patterns by Use Case

### Web Application Integration
1. Start with [API Overview](./API_OVERVIEW.md) to understand the platform
2. Follow [Quick Start Guide](./quick-start.md) for initial setup
3. Implement patterns from [API Patterns Guide](./API_PATTERNS.md) for production
4. Reference [API User Guide](./API_USER_GUIDE.md) for all endpoints
5. Use [Authentication Patterns](./authentication-patterns.md) for secure auth

### Iframe/Embedded Application
1. Review [Security Warning](./SECURITY-WARNING.md) for critical patterns to avoid
2. Implement [Secure Iframe Integration](./iframe-integration-secure.md)
3. Follow [API Patterns](./API_PATTERNS.md) for BFF proxy setup
4. Use [API Troubleshooting Guide](./api-troubleshooting-guide.md) for debugging

### Existing Implementation Migration
1. **URGENT**: Read [Security Warning](./SECURITY-WARNING.md) first
2. Use [Migration Guide](./migration-guide-from-url-auth.md) for step-by-step upgrade
3. Adopt patterns from [API Patterns Guide](./API_PATTERNS.md) for best practices
4. Follow [Secure Localhost Development](./SECURE-localhost-development.md) for new patterns

## 🔍 Quick Reference

### Security Principles
- **Server-side API key management** - Never expose credentials in client code
- **HTTP-only cookie authentication** - Secure session management patterns
- **Environment variable configuration** - Proper credential isolation
- **Production-ready error handling** - Security without data exposure

### Integration Approach
- **POST-based authentication flows** instead of URL tokens
- **Server-side proxy patterns** for sensitive API calls
- **Complete environment isolation** between development and production
- **Origin validation** for secure iframe communication

*Complete implementation examples available in the individual guides*

## 📊 Documentation Quality Standards

### Security Validation
- ✅ All examples use environment variables for credentials
- ✅ No hardcoded API keys or tokens
- ✅ Secure communication patterns only
- ✅ Complete environment isolation
- ✅ Proper error handling without data exposure

### Code Quality
- ✅ Production-ready TypeScript examples
- ✅ Comprehensive error handling
- ✅ Performance optimization patterns
- ✅ Accessibility compliance
- ✅ Cross-browser compatibility

### Documentation Standards
- ✅ Step-by-step implementation guides
- ✅ Security warnings and best practices
- ✅ Troubleshooting and debugging guidance
- ✅ Complete code examples
- ✅ Regular security audits and updates

## 🆘 Getting Help

### Before You Start
1. **Security First**: Read [Security Warning](./SECURITY-WARNING.md) to avoid common vulnerabilities
2. **Quick Setup**: Follow [Quick Start Guide](./quick-start.md) for fastest secure integration
3. **Development**: Set up [Secure Localhost Development](./SECURE-localhost-development.md)

### When You Need Help
1. **API Issues**: Check [API Troubleshooting Guide](./api-troubleshooting-guide.md)
2. **Authentication Problems**: Review [Authentication Patterns](./authentication-patterns.md)
3. **Header Errors**: Reference [API Headers Guide](./api-headers-reference.md)

### Community & Support
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share solutions
- **Security Issues**: Email security@oriva.io for security concerns

## 🔄 Documentation Updates

### Version History
- **v2.0.0** (January 2025): Complete security rewrite with vulnerability fixes
- **v1.0.0** (Previous): Legacy documentation (contains security vulnerabilities)

### Update Policy
- **Security updates**: Immediate for critical vulnerabilities
- **Feature updates**: Monthly with version control
- **Breaking changes**: 90-day notice with migration guides

## 🧪 Testing Your Integration

### Security Checklist
- [ ] No API keys in client-side code
- [ ] Authentication uses HTTP-only cookies
- [ ] All requests use HTTPS
- [ ] Environment variables for credentials
- [ ] Proper error handling implemented
- [ ] Origin validation for iframe communication

### Performance Checklist
- [ ] API response caching implemented
- [ ] Rate limiting handled gracefully
- [ ] Error retry logic with exponential backoff
- [ ] Request timeout handling
- [ ] Monitoring and logging configured

### Functionality Checklist
- [ ] Authentication flow completes successfully
- [ ] All required API calls working
- [ ] Error states handled appropriately
- [ ] User experience is smooth and responsive
- [ ] Iframe integration (if applicable) works correctly

## 📈 Best Practices Summary

### Security
1. **Never expose credentials** in client-side code
2. **Use server-side proxy patterns** for sensitive operations
3. **Implement proper session management** with HTTP-only cookies
4. **Validate all inputs and origins** for security
5. **Log security events** for monitoring and auditing

### Performance
1. **Cache API responses** when appropriate
2. **Implement retry logic** with exponential backoff
3. **Use batch operations** where available
4. **Monitor response times** and error rates
5. **Optimize for mobile networks** and slow connections

### Maintainability
1. **Use environment variables** for configuration
2. **Implement comprehensive error handling**
3. **Write tests** for critical integration points
4. **Document your implementation** for team members
5. **Follow semantic versioning** for your API integrations

---

**Important**: This documentation prioritizes security and follows industry best practices. All examples are production-ready and have been audited for security vulnerabilities.

**Need immediate help?** Start with the [Quick Start Guide](./quick-start.md) or check [Security Warning](./SECURITY-WARNING.md) for critical security information.

*Last Updated: January 2025 | Security Audit: January 2025*