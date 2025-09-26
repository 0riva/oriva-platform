# Localhost Development Integration Guide

**Version**: 1.0.0
**Last Updated**: January 2025

## Overview

This guide helps third-party developers set up a localhost development environment that connects to real Oriva platform data while maintaining production safety and optimal development speed.

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- Valid Oriva developer credentials
- Access to your application's database
- Basic understanding of JWT authentication

## Environment Setup

### 1. Required Environment Variables

Create a `.env.local` file in your project root:

```bash
# Oriva Platform Credentials
ORIVA_API_KEY=your_api_key_here
ORIVA_CLIENT_ID=your_client_id_here
ORIVA_API_URL=https://api.oriva.io

# Database Configuration
DATABASE_URL=your_database_connection_string
DATABASE_ANON_KEY=your_database_public_key

# Development Settings
NODE_ENV=development
PORT=8082
```

### 2. Development Launcher Setup

Create a development launcher HTML file to simulate authenticated sessions:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Development Launcher</title>
    <script>
        // Replace with your development tokens
        const config = {
            accessToken: 'your_dev_access_token',
            userId: 'your_dev_user_id',
            redirectUrl: 'http://localhost:8082'
        };

        // Redirect with authentication parameters
        window.location.href = `${config.redirectUrl}/?access_token=${config.accessToken}&user_id=${config.userId}`;
    </script>
</head>
<body>
    <p>Redirecting to development environment...</p>
</body>
</html>
```

## Authentication Integration Pattern

### Implementing Dual-Path Authentication

This pattern ensures your app works both locally and in production:

```typescript
// services/auth.ts
export class AuthService {
    async authenticateUser(params: AuthParams): Promise<User | null> {
        try {
            // Primary: Attempt API authentication
            const apiUser = await this.fetchUserFromAPI(params);
            if (apiUser) {
                return apiUser;
            }
        } catch (error) {
            console.log('API authentication failed, using fallback');
        }

        // Fallback: Use local development auth
        if (this.isDevelopment() && params.accessToken) {
            return this.getLocalDevelopmentUser(params);
        }

        return null;
    }

    private isDevelopment(): boolean {
        return process.env.NODE_ENV === 'development';
    }

    private async fetchUserFromAPI(params: AuthParams): Promise<User | null> {
        // Your API authentication logic
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${params.accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('API authentication failed');
        }

        return response.json();
    }

    private getLocalDevelopmentUser(params: AuthParams): User {
        // Return a development user object
        return {
            id: params.userId,
            email: 'developer@example.com',
            name: 'Developer',
            // Add other required user properties
        };
    }
}
```

## Data Source Configuration

### Setting Up Database Connection

Configure your data source to work with both local and production environments:

```javascript
// config/dataSource.js
class DataSource {
    constructor() {
        this.initializeConnection();
    }

    async initializeConnection() {
        const config = {
            url: process.env.DATABASE_URL,
            key: process.env.DATABASE_ANON_KEY,
            options: {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true
                }
            }
        };

        // Initialize your database client
        this.client = createClient(config);
    }

    async getProfiles() {
        // Check for authenticated user in development
        if (this.isDevelopment()) {
            const authUser = await this.getAuthenticatedUser();
            if (authUser) {
                return this.formatUserProfile(authUser);
            }
        }

        // Standard production flow
        return this.fetchProfilesFromDatabase();
    }

    private isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    private formatUserProfile(user) {
        return {
            profileId: user.id,
            profileName: user.name || user.email,
            isActive: true
        };
    }
}

export default DataSource;
```

## API Proxy Configuration

### Setting Up BFF (Backend for Frontend) Pattern

Create an API proxy to handle authentication and avoid CORS issues:

```javascript
// api/proxy/user.js
export default async function handler(req, res) {
    // Validate request method
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Extract authentication from request
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Forward request to Oriva API
        const response = await fetch(`${process.env.ORIVA_API_URL}/user/me`, {
            headers: {
                'Authorization': authHeader,
                'X-Client-Id': process.env.ORIVA_CLIENT_ID,
                'X-API-Key': process.env.ORIVA_API_KEY
            }
        });

        // Handle response
        if (!response.ok) {
            // In development, return mock data
            if (process.env.NODE_ENV === 'development') {
                return res.status(200).json({
                    id: 'dev-user',
                    email: 'developer@example.com',
                    name: 'Developer'
                });
            }

            return res.status(response.status).json({
                error: 'Failed to fetch user data'
            });
        }

        const userData = await response.json();
        return res.status(200).json(userData);

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
}
```

## Error Handling Best Practices

### Implementing Graceful Degradation

```typescript
// utils/errorHandler.ts
export class ErrorHandler {
    static async handleAPIError(error: Error, context: string) {
        console.error(`Error in ${context}:`, error.message);

        // Log to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            await this.logToMonitoring(error, context);
        }

        // Return appropriate fallback
        return this.getFallbackResponse(context);
    }

    static getFallbackResponse(context: string) {
        const fallbacks = {
            'user-fetch': { id: 'fallback', name: 'User' },
            'profile-load': [],
            'data-sync': { status: 'offline', cached: true }
        };

        return fallbacks[context] || null;
    }

    static async logToMonitoring(error: Error, context: string) {
        // Implement your monitoring integration
        // e.g., Sentry, LogRocket, etc.
    }
}
```

## Testing Your Integration

### 1. Local Development Testing

```bash
# Start your development server
npm run dev

# In another terminal, serve your launcher HTML
npx http-server -p 8080

# Open launcher in browser
open http://localhost:8080/launcher.html
```

### 2. Verification Checklist

- [ ] Authentication tokens are properly passed via URL
- [ ] User profile loads correctly
- [ ] Database connection is established
- [ ] API calls fallback gracefully on failure
- [ ] No production credentials in localhost environment
- [ ] Error handling works as expected

### 3. Production Safety Check

Before deploying, ensure:
- Development-only code is environment-gated
- Fallback mechanisms don't affect production
- All credentials are properly secured
- Error logging is configured for production

## Common Issues and Solutions

### Issue: Profile Not Loading

**Solution Steps:**
1. Check browser console for authentication errors
2. Verify JWT tokens are valid and not expired
3. Ensure environment variables are correctly set
4. Check network tab for failed API requests

### Issue: Database Connection Failures

**Solution Steps:**
1. Verify database URL and credentials
2. Check network connectivity
3. Ensure database allows connections from localhost
4. Review CORS configuration

### Issue: API Pattern Matching Errors

**Solution Steps:**
1. Implement fallback data for development
2. Use proxy endpoints to handle API communication
3. Validate request headers and parameters
4. Check API documentation for correct endpoint formats

## Security Best Practices

### Protecting Sensitive Information

1. **Never commit credentials**: Use environment variables
2. **Rotate development tokens**: Regular token rotation
3. **Limit scope**: Development tokens should have minimal permissions
4. **Secure storage**: Use secret management tools
5. **Audit logs**: Monitor API usage in development

### Development vs Production Separation

```typescript
// config/environment.ts
export const getConfig = () => {
    const baseConfig = {
        appName: 'Your App',
        version: '1.0.0'
    };

    if (process.env.NODE_ENV === 'production') {
        return {
            ...baseConfig,
            apiUrl: process.env.PRODUCTION_API_URL,
            strict: true,
            logging: 'error'
        };
    }

    return {
        ...baseConfig,
        apiUrl: process.env.DEVELOPMENT_API_URL || 'http://localhost:3000',
        strict: false,
        logging: 'debug'
    };
};
```

## Performance Optimization Tips

### 1. Caching Strategy

```typescript
// services/cache.ts
class CacheService {
    private cache = new Map();
    private ttl = 5 * 60 * 1000; // 5 minutes

    async get(key: string, fetcher: () => Promise<any>) {
        const cached = this.cache.get(key);

        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }

        const data = await fetcher();
        this.cache.set(key, {
            data,
            expires: Date.now() + this.ttl
        });

        return data;
    }
}
```

### 2. Optimize API Calls

- Batch requests where possible
- Implement request deduplication
- Use pagination for large datasets
- Cache static resources

## Next Steps

1. **Set up monitoring**: Implement error tracking and performance monitoring
2. **Add testing**: Create integration tests for your authentication flow
3. **Document your API**: Keep your integration documentation up-to-date
4. **Join the community**: Connect with other developers for support

## Support Resources

- **Documentation**: Check our full API documentation
- **Community Forum**: Ask questions and share solutions
- **Sample Projects**: Review example implementations
- **Support Tickets**: Contact our developer support team

## Changelog

### Version 1.0.0 (January 2025)
- Initial release of localhost integration guide
- Dual-path authentication pattern
- Database connection setup
- Error handling best practices

---

**Note**: This guide provides general patterns and best practices. Specific implementation details may vary based on your application's requirements and technology stack.