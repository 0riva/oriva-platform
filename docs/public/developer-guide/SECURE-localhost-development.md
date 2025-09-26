# Localhost Development Integration Guide

**Version**: 2.0.0 - Production Ready
**Last Updated**: January 2025

## Overview

This guide provides secure patterns for setting up localhost development environments that integrate with the Oriva platform. These patterns are designed for production use and follow industry security best practices.

## Why This Guide Exists

Development environments often require real-time testing with production-like data while maintaining security. This guide shows you how to achieve fast development cycles without compromising security or exposing sensitive information.

## Core Principles

### Development Best Practices ✅
- **Environment Isolation**: Complete separation of development and production
- **Secure Authentication**: Cookie-based sessions with proper security headers
- **Test Data Only**: Synthetic data that mimics production structure
- **Audit Trail**: All development access logged and monitored

### Security Standards ✅
- OWASP compliance for web application security
- Zero-trust architecture for development environments
- Encrypted communication for all API calls
- Regular credential rotation and monitoring

## Secure Architecture Overview

```mermaid
graph TD
    A[Developer] -->|HTTPS Only| B[Localhost App]
    B -->|POST Auth| C[Dev Auth Server]
    C -->|HTTP-Only Cookie| B
    B -->|Isolated Connection| D[Dev Database]
    B -->X E[Production Database]

    style E fill:#ff0000,stroke:#ff0000,color:#fff
    style D fill:#00ff00,stroke:#00ff00,color:#000
```

## Step 1: Isolated Development Environment

### Create Development-Only Database

**Never use production data in development.** Create a completely isolated test environment:

```bash
# Create a separate development database project
# Use a different provider or isolated instance
# NEVER use production connection strings

# .env.development (NEVER commit this file)
DEV_DATABASE_URL=postgresql://localhost:5432/oriva_dev
DEV_API_URL=http://localhost:3001
DEV_AUTH_SECRET=dev-only-secret-change-this

# .env.production (separate file, different values)
# Production values managed by deployment platform
```

### Generate Synthetic Test Data

```typescript
// scripts/generateTestData.ts
import { faker } from '@faker-js/faker';

interface TestUser {
    id: string;
    email: string;
    name: string;
    role: 'developer' | 'tester';
}

export function generateTestUsers(count: number): TestUser[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `test-user-${i + 1}`,
        email: `test${i + 1}@example.dev`,
        name: faker.person.fullName(),
        role: i === 0 ? 'developer' : 'tester'
    }));
}

// Generate test data, never use real user data
const testUsers = generateTestUsers(10);
```

## Step 2: Secure Authentication Flow

### POST-Based Authentication (No URL Parameters)

```typescript
// auth/secureDevAuth.ts
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

export class SecureDevAuth {
    private readonly SECRET = new TextEncoder().encode(
        process.env.DEV_AUTH_SECRET || 'dev-secret'
    );

    async createDevSession(username: string): Promise<string> {
        // Generate secure session token
        const token = await new SignJWT({
            sub: username,
            env: 'development',
            exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(this.SECRET);

        return token;
    }

    async validateSession(token: string): Promise<boolean> {
        try {
            const { payload } = await jwtVerify(token, this.SECRET);
            return payload.env === 'development';
        } catch {
            return false;
        }
    }
}
```

### Secure Login Endpoint

```typescript
// api/auth/dev-login.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { SecureDevAuth } from './secureDevAuth';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Not found' });
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;

    // Validate development credentials
    if (!isValidDevCredentials(username, password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const auth = new SecureDevAuth();
    const token = await auth.createDevSession(username);

    // Set HTTP-only, secure cookie
    res.setHeader('Set-Cookie', [
        `dev_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900`
    ]);

    res.status(200).json({ success: true });
}

function isValidDevCredentials(username: string, password: string): boolean {
    // Implement your secure credential validation
    // Consider using bcrypt for password hashing
    const validCredentials = process.env.DEV_CREDENTIALS?.split(':') || [];
    return validCredentials[0] === username && validCredentials[1] === password;
}
```

### Secure Development Login Form

```html
<!-- dev-login.html - Development only -->
<!DOCTYPE html>
<html>
<head>
    <title>Secure Development Login</title>
    <meta name="robots" content="noindex, nofollow">
</head>
<body>
    <form id="devLogin" action="/api/auth/dev-login" method="POST">
        <h2>Development Environment Only</h2>

        <label for="username">Dev Username:</label>
        <input type="text" id="username" name="username" required>

        <label for="password">Dev Password:</label>
        <input type="password" id="password" name="password" required>

        <input type="hidden" name="csrf" id="csrf">

        <button type="submit">Login to Dev Environment</button>
    </form>

    <script>
        // Add CSRF token
        document.getElementById('csrf').value =
            crypto.getRandomValues(new Uint8Array(16))
                .reduce((a, b) => a + b.toString(16).padStart(2, '0'), '');

        // Submit via fetch for better control
        document.getElementById('devLogin').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const response = await fetch('/api/auth/dev-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(formData)),
                credentials: 'same-origin'
            });

            if (response.ok) {
                window.location.href = '/dashboard';
            } else {
                alert('Login failed');
            }
        });
    </script>
</body>
</html>
```

## Step 3: Secure API Communication

### Development API Proxy with Security

```typescript
// api/dev-proxy.ts
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Development only
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).end();
    }

    // Validate session cookie
    const session = req.cookies.dev_session;
    if (!session || !(await validateSession(session))) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Rate limiting for development
    if (!checkRateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    // Proxy to development API only
    const devApiUrl = process.env.DEV_API_URL;
    if (!devApiUrl || devApiUrl.includes('prod')) {
        throw new Error('Invalid development API configuration');
    }

    // Forward request with security headers
    const response = await fetch(`${devApiUrl}${req.url}`, {
        method: req.method,
        headers: {
            ...req.headers,
            'X-Dev-Environment': 'true',
            'X-Request-ID': crypto.randomUUID()
        },
        body: req.body ? JSON.stringify(req.body) : undefined
    });

    // Return response
    const data = await response.json();
    res.status(response.status).json(data);
}
```

## Step 4: Security Best Practices

### Environment Variable Security

```typescript
// config/secure-config.ts
export class SecureConfig {
    private static instance: SecureConfig;
    private readonly config: Map<string, string>;

    private constructor() {
        this.config = new Map();
        this.loadConfig();
        this.validateConfig();
    }

    private loadConfig(): void {
        // Only load development variables in development
        if (process.env.NODE_ENV === 'development') {
            this.config.set('DATABASE_URL', process.env.DEV_DATABASE_URL!);
            this.config.set('API_URL', process.env.DEV_API_URL!);
        }
    }

    private validateConfig(): void {
        // Ensure no production values in development
        if (process.env.NODE_ENV === 'development') {
            const dbUrl = this.config.get('DATABASE_URL') || '';
            if (dbUrl.includes('prod') || dbUrl.includes('live')) {
                throw new Error('Production database detected in development!');
            }
        }
    }

    public static getInstance(): SecureConfig {
        if (!SecureConfig.instance) {
            SecureConfig.instance = new SecureConfig();
        }
        return SecureConfig.instance;
    }

    public get(key: string): string | undefined {
        return this.config.get(key);
    }
}
```

### Session Management with Security

```typescript
// services/secureSessionManager.ts
export class SecureSessionManager {
    private readonly SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
    private sessions = new Map<string, SessionData>();

    createSession(userId: string): string {
        const sessionId = crypto.randomBytes(32).toString('hex');

        this.sessions.set(sessionId, {
            userId,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.SESSION_DURATION,
            ipAddress: null, // Set from request
            userAgent: null  // Set from request
        });

        // Auto-cleanup expired sessions
        this.cleanupExpiredSessions();

        return sessionId;
    }

    validateSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return false;
        }

        if (Date.now() > session.expiresAt) {
            this.sessions.delete(sessionId);
            return false;
        }

        // Refresh session on activity
        session.expiresAt = Date.now() + this.SESSION_DURATION;

        return true;
    }

    private cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.sessions.delete(id);
            }
        }
    }
}
```

## Step 5: Security Monitoring

### Development Security Logging

```typescript
// utils/securityLogger.ts
export class SecurityLogger {
    private static logSecurityEvent(event: SecurityEvent): void {
        const logEntry = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            event: event.type,
            severity: event.severity,
            details: event.details,
            stackTrace: event.error?.stack
        };

        // In development, log to console with color coding
        if (process.env.NODE_ENV === 'development') {
            const color = event.severity === 'critical' ? '\x1b[31m' : '\x1b[33m';
            console.log(`${color}[SECURITY]`, JSON.stringify(logEntry, null, 2), '\x1b[0m');
        }

        // Also write to security log file
        this.writeToSecurityLog(logEntry);
    }

    static logAuthAttempt(success: boolean, username: string, ip: string): void {
        this.logSecurityEvent({
            type: 'auth_attempt',
            severity: success ? 'info' : 'warning',
            details: { success, username, ip }
        });
    }

    static logSuspiciousActivity(activity: string, details: any): void {
        this.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'warning',
            details: { activity, ...details }
        });
    }
}
```

## Security Checklist

### Before Starting Development

- [ ] Isolated development database created
- [ ] No production credentials in development environment
- [ ] Environment variables properly separated
- [ ] HTTPS configured for localhost (using mkcert or similar)
- [ ] Security logging enabled

### During Development

- [ ] Never pass sensitive data in URLs
- [ ] Use POST requests for authentication
- [ ] Implement CSRF protection
- [ ] Use HTTP-only cookies for sessions
- [ ] Validate all user inputs
- [ ] Monitor security logs

### Before Sharing Code

- [ ] Remove all real credentials
- [ ] Clear git history of sensitive data
- [ ] Review for hardcoded secrets
- [ ] Ensure .env files are gitignored
- [ ] Document security requirements

## Common Security Mistakes to Avoid

### ❌ NEVER Do This

```javascript
// WRONG - Exposes token in URL
window.location.href = `/?token=${authToken}`;

// WRONG - Uses production database
const db = connectToDatabase(process.env.PROD_DATABASE_URL);

// WRONG - Logs sensitive data
console.log('User password:', password);

// WRONG - Stores secrets in code
const API_KEY = 'sk-1234567890abcdef';
```

### ✅ ALWAYS Do This

```javascript
// RIGHT - Use secure cookie
res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure`);

// RIGHT - Use isolated dev database
const db = connectToDatabase(process.env.DEV_DATABASE_URL);

// RIGHT - Log safely
console.log('Login attempt for user:', username);

// RIGHT - Use environment variables
const API_KEY = process.env.DEV_API_KEY;
```

## Incident Response

If you accidentally expose credentials:

1. **Immediately rotate** all affected credentials
2. **Revoke** exposed tokens and keys
3. **Audit** access logs for unauthorized use
4. **Notify** your security team
5. **Document** the incident and prevention measures

## Additional Resources

- [OWASP Development Guide](https://owasp.org/www-project-developer-guide/)
- [Security Headers Reference](https://securityheaders.com/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Remember**: Security is not optional. Every developer is responsible for maintaining secure development practices.