# Production Deployment Checklist

## 🎯 **Deployment Overview**

This document outlines the steps required to deploy the new privacy-first multi-profile and group API endpoints to production at `api.oriva.io`.

## 📋 **Pre-Deployment Checklist**

### **✅ Code Quality**
- [x] All tests passing (70/70 tests)
- [x] ESLint warnings only (no errors)
- [x] Security audit clean (0 vulnerabilities)
- [x] Code coverage acceptable (24.92% - focused on core functionality)
- [x] All new endpoints implemented and tested

### **✅ Documentation**
- [x] OpenAPI specifications updated
- [x] Privacy-first design documented
- [x] Developer authorization flow documented
- [x] API endpoint documentation complete
- [x] Internal documentation for Oriva Core team

### **✅ Testing**
- [x] Unit tests for all new endpoints
- [x] Integration tests with existing endpoints
- [x] Permission validation tests
- [x] Data sanitization tests
- [x] Error handling tests
- [x] CI/CD pipeline working

## 🚀 **Deployment Steps**

### **Step 1: Environment Configuration**

#### **Production Environment Variables**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-production-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Oriva Core Integration
ORIVA_CORE_API_URL=https://core.oriva.io/api
ORIVA_CORE_API_KEY=your-production-core-api-key

# API Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Security
CORS_ORIGIN=https://oriva.io,https://app.oriva.io
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
```

#### **Vercel Configuration**
Update `vercel.json` for production:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  }
}
```

### **Step 2: Database Migration**

#### **Supabase Production Setup**
1. **Create Production Database**:
   ```sql
   -- Extension profile permissions
   CREATE TABLE extension_profile_permissions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     oriva_profile_id VARCHAR(255) NOT NULL,
     profile_name VARCHAR(255) NOT NULL,
     permissions TEXT[] DEFAULT '{"read"}',
     granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     is_active BOOLEAN DEFAULT true,
     
     UNIQUE(extension_id, user_id, oriva_profile_id)
   );

   -- Extension group permissions
   CREATE TABLE extension_group_permissions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     oriva_group_id VARCHAR(255) NOT NULL,
     group_name VARCHAR(255) NOT NULL,
     permissions TEXT[] DEFAULT '{"read"}',
     granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     is_active BOOLEAN DEFAULT true,
     
     UNIQUE(extension_id, user_id, oriva_group_id)
   );

   -- Extension active profiles
   CREATE TABLE extension_active_profiles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     extension_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     oriva_profile_id VARCHAR(255) NOT NULL,
     activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     
     UNIQUE(extension_id, user_id)
   );

   -- Indexes for performance
   CREATE INDEX idx_extension_profile_permissions_extension_user 
   ON extension_profile_permissions(extension_id, user_id);
   CREATE INDEX idx_extension_profile_permissions_user 
   ON extension_profile_permissions(user_id);
   CREATE INDEX idx_extension_group_permissions_extension_user 
   ON extension_group_permissions(extension_id, user_id);
   CREATE INDEX idx_extension_group_permissions_user 
   ON extension_group_permissions(user_id);
   CREATE INDEX idx_extension_active_profiles_extension_user 
   ON extension_active_profiles(extension_id, user_id);
   ```

2. **Set up Row Level Security (RLS)**:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE extension_profile_permissions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE extension_group_permissions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE extension_active_profiles ENABLE ROW LEVEL SECURITY;

   -- Create policies for service role access
   CREATE POLICY "Service role can manage extension permissions" 
   ON extension_profile_permissions FOR ALL 
   TO service_role USING (true);

   CREATE POLICY "Service role can manage group permissions" 
   ON extension_group_permissions FOR ALL 
   TO service_role USING (true);

   CREATE POLICY "Service role can manage active profiles" 
   ON extension_active_profiles FOR ALL 
   TO service_role USING (true);
   ```

### **Step 3: API Key Management**

#### **Production API Keys**
1. **Generate Production API Keys**:
   ```bash
   # Generate secure API keys for production
   openssl rand -hex 32
   ```

2. **Update Supabase with Production Keys**:
   ```sql
   -- Insert production API keys
   INSERT INTO developer_api_keys (
     key_hash,
     user_id,
     name,
     permissions,
     is_active,
     created_at
   ) VALUES (
     'hash_of_production_key_1',
     'production_user_id',
     'Production Platform API',
     '["user:read", "entries:read", "templates:read", "profiles:read", "profiles:write", "groups:read", "groups:write"]',
     true,
     NOW()
   );
   ```

### **Step 4: Monitoring & Logging**

#### **Production Monitoring Setup**
1. **Health Check Endpoint**:
   ```javascript
   app.get('/health', (req, res) => {
     res.json({
       status: 'healthy',
       timestamp: new Date().toISOString(),
       version: process.env.APP_VERSION || '1.0.0',
       environment: process.env.NODE_ENV,
       endpoints: {
         profiles: '/api/v1/profiles/*',
         groups: '/api/v1/groups/*'
       }
     });
   });
   ```

2. **Error Logging**:
   ```javascript
   // Add to api/index.js
   const winston = require('winston');
   
   const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.errors({ stack: true }),
       winston.format.json()
     ),
     transports: [
       new winston.transports.Console(),
       new winston.transports.File({ filename: 'error.log', level: 'error' }),
       new winston.transports.File({ filename: 'combined.log' })
     ]
   });
   ```

3. **Performance Monitoring**:
   ```javascript
   // Add performance monitoring middleware
   app.use((req, res, next) => {
     const start = Date.now();
     res.on('finish', () => {
       const duration = Date.now() - start;
       logger.info('API Request', {
         method: req.method,
         url: req.url,
         status: res.statusCode,
         duration: `${duration}ms`,
         userAgent: req.get('User-Agent')
       });
     });
     next();
   });
   ```

### **Step 5: Security Hardening**

#### **Production Security Measures**
1. **Rate Limiting**:
   ```javascript
   const rateLimit = require('express-rate-limit');
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 1000, // limit each IP to 1000 requests per windowMs
     message: 'Too many requests from this IP, please try again later.',
     standardHeaders: true,
     legacyHeaders: false,
   });
   
   app.use('/api/', limiter);
   ```

2. **CORS Configuration**:
   ```javascript
   const corsOptions = {
     origin: process.env.CORS_ORIGIN?.split(',') || ['https://oriva.io'],
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-ID'],
     credentials: true
   };
   
   app.use(cors(corsOptions));
   ```

3. **Input Validation**:
   ```javascript
   const { body, param, validationResult } = require('express-validator');
   
   // Add validation middleware
   const validateRequest = (req, res, next) => {
     const errors = validationResult(req);
     if (!errors.isEmpty()) {
       return res.status(400).json({
         success: false,
         error: 'Validation failed',
         details: errors.array()
       });
     }
     next();
   };
   ```

### **Step 6: Deployment Process**

#### **Vercel Deployment**
1. **Connect to Vercel**:
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Login to Vercel
   vercel login
   
   # Link project
   vercel link
   ```

2. **Deploy to Production**:
   ```bash
   # Deploy to production
   vercel --prod
   
   # Set environment variables
   vercel env add SUPABASE_URL production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   vercel env add ORIVA_CORE_API_URL production
   vercel env add ORIVA_CORE_API_KEY production
   ```

3. **Verify Deployment**:
   ```bash
   # Test health endpoint
   curl https://api.oriva.io/health
   
   # Test new endpoints
   curl https://api.oriva.io/api/v1/profiles/available \
     -H "Authorization: Bearer your_production_api_key"
   ```

### **Step 7: Post-Deployment Verification**

#### **Production Testing**
1. **Health Check**:
   ```bash
   curl https://api.oriva.io/health
   # Expected: 200 OK with status: "healthy"
   ```

2. **API Endpoint Testing**:
   ```bash
   # Test profile endpoints
   curl https://api.oriva.io/api/v1/profiles/available \
     -H "Authorization: Bearer your_production_api_key"
   
   # Test group endpoints
   curl https://api.oriva.io/api/v1/groups \
     -H "Authorization: Bearer your_production_api_key"
   ```

3. **Error Handling Testing**:
   ```bash
   # Test invalid API key
   curl https://api.oriva.io/api/v1/profiles/available \
     -H "Authorization: Bearer invalid_key"
   # Expected: 401 Unauthorized
   
   # Test missing API key
   curl https://api.oriva.io/api/v1/profiles/available
   # Expected: 401 Unauthorized
   ```

4. **Performance Testing**:
   ```bash
   # Test response times
   time curl https://api.oriva.io/api/v1/profiles/available \
     -H "Authorization: Bearer your_production_api_key"
   # Expected: < 200ms response time
   ```

## 📊 **Production Monitoring**

### **Key Metrics to Monitor**
1. **API Performance**:
   - Response times for all endpoints
   - Error rates (4xx, 5xx responses)
   - Request volume and patterns

2. **Security Metrics**:
   - Failed authentication attempts
   - Permission validation failures
   - Rate limit violations

3. **Business Metrics**:
   - Profile endpoint usage
   - Group endpoint usage
   - Extension authorization success rates

### **Alerting Setup**
1. **Critical Alerts**:
   - API downtime (> 5 minutes)
   - High error rate (> 5%)
   - Security breaches or suspicious activity

2. **Warning Alerts**:
   - Slow response times (> 500ms)
   - High request volume (> 1000/min)
   - Database connection issues

## 🚨 **Rollback Plan**

### **Emergency Rollback**
1. **Immediate Rollback**:
   ```bash
   # Revert to previous deployment
   vercel rollback
   
   # Or deploy previous version
   vercel --prod --force
   ```

2. **Database Rollback**:
   ```sql
   -- Disable new endpoints by removing permissions
   UPDATE developer_api_keys 
   SET permissions = '["user:read", "entries:read", "templates:read"]'
   WHERE name = 'Production Platform API';
   ```

3. **Communication Plan**:
   - Notify stakeholders immediately
   - Document the issue and resolution
   - Schedule post-incident review

## 📋 **Deployment Checklist**

### **Pre-Deployment**
- [ ] All tests passing
- [ ] Security audit clean
- [ ] Documentation updated
- [ ] Environment variables configured
- [ ] Database schema ready
- [ ] API keys generated
- [ ] Monitoring configured

### **Deployment**
- [ ] Deploy to Vercel production
- [ ] Set environment variables
- [ ] Run database migrations
- [ ] Update API keys in database
- [ ] Configure monitoring
- [ ] Set up alerting

### **Post-Deployment**
- [ ] Health check passing
- [ ] All endpoints responding
- [ ] Error handling working
- [ ] Performance acceptable
- [ ] Security measures active
- [ ] Monitoring data flowing
- [ ] Documentation updated

## 🎯 **Success Criteria**

### **Technical Success**
- [ ] All endpoints responding correctly
- [ ] Response times < 200ms
- [ ] Error rate < 0.1%
- [ ] 99.9% uptime
- [ ] Security measures active

### **Business Success**
- [ ] Extensions can access authorized profiles
- [ ] Extensions can access authorized groups
- [ ] Users can manage permissions
- [ ] Privacy protection working
- [ ] Developer experience positive

---

**Deployment Date**: TBD
**Deployment Team**: Platform API Team
**Rollback Contact**: Platform API Team Lead
