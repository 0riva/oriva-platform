# Quick Start Guide for Oriva Platform Integration

**Time to First Success**: ~15 minutes

## Prerequisites Checklist

Before you begin, ensure you have:
- [ ] Node.js 18+ and npm installed
- [ ] Oriva developer account and API credentials
- [ ] Code editor (VS Code recommended)
- [ ] Git for version control

## Step 1: Clone the Starter Template

```bash
# Clone the official starter template
git clone https://github.com/oriva/starter-template.git my-oriva-app
cd my-oriva-app

# Install dependencies
npm install
```

## Step 2: Configure Environment

Create a `.env.local` file in your project root:

```bash
# Required Configuration
ORIVA_API_KEY=your_api_key_here
ORIVA_CLIENT_ID=your_client_id_here

# Optional: Your Database
DATABASE_URL=your_database_url
DATABASE_ANON_KEY=your_database_key
```

## Step 3: Set Up Authentication

The starter template includes a basic auth setup. Customize it for your needs:

```typescript
// src/config/auth.config.ts
export const authConfig = {
    // Your app's authentication settings
    redirectUrl: 'http://localhost:3000/dashboard',
    scope: ['read:profile', 'write:data'],
    // Session settings
    sessionDuration: 7200, // 2 hours
    refreshEnabled: true
};
```

## Step 4: Run Your First Development Session

```bash
# Start the development server
npm run dev

# Your app will be available at http://localhost:3000
```

## Step 5: Test the Integration

1. Open your browser to `http://localhost:3000`
2. Click "Connect with Oriva"
3. Authenticate with your developer credentials
4. You should see your profile data loaded

## What's Next?

### Essential Reads
- [Localhost Development Guide](./SECURE-localhost-development.md) - Set up local development with real data
- [Authentication Patterns](./authentication-patterns.md) - Implement secure auth flows
- [API Headers Reference](./api-headers-reference.md) - Complete API documentation

### Build Your First Feature

Try implementing a simple feature to get familiar with the platform:

```typescript
// Example: Fetch user's workspace data
import { OrivaClient } from '@oriva/sdk';

const client = new OrivaClient({
    apiKey: process.env.ORIVA_API_KEY,
    clientId: process.env.ORIVA_CLIENT_ID
});

async function getWorkspaceData(userId: string) {
    try {
        const workspace = await client.workspaces.get(userId);
        return workspace;
    } catch (error) {
        console.error('Failed to fetch workspace:', error);
        return null;
    }
}
```

## Common First-Time Issues

### "API Key Invalid" Error
- Verify your API key in the Oriva developer dashboard
- Ensure there are no extra spaces in your `.env.local` file
- Check that environment variables are being loaded correctly

### "CORS Error" in Browser
- Use the provided proxy configuration in development
- Ensure you're using `http://localhost:3000` (not `127.0.0.1`)
- Check that your client ID is registered for localhost development

### "Cannot Connect to Database"
- Verify your database credentials
- Ensure your database allows connections from your IP
- Check firewall and network settings

## Getting Help

- **Documentation**: [Complete Developer Guide](./README.md)
- **Community**: GitHub Issues and Discussions
- **Support**: GitHub Issues for technical support
- **Sample Apps**: Check out example implementations on GitHub

## Ready for Production?

When you're ready to deploy:

1. **Security Review**: Audit your authentication and data handling
2. **Environment Setup**: Configure production environment variables
3. **Performance Testing**: Test with expected user load
4. **Documentation**: Review [Security Warning](./SECURITY-WARNING.md) for final security checks

---

**Tip**: Keep this guide handy during development. Most integration issues can be resolved by reviewing these basic steps.