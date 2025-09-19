# API Troubleshooting Guide

## Learning from the API Logic Bug Investigation

### The Problem
During a recent investigation, we spent significant time debugging an "API logic bug" that turned out to be a misdiagnosis. This guide documents the lessons learned to prevent similar time-wasting in the future.

### What Happened
1. **Initial Report**: "API logic still has a bug - it's not properly querying or joining database tables"
2. **Investigation**: Created comprehensive debug scripts and database schema updates
3. **Discovery**: The API was actually working correctly all along
4. **Root Cause**: Misunderstanding of the actual problem vs. symptoms

### Key Lessons Learned

#### 1. Always Verify the Problem First
**❌ What we did wrong:**
- Jumped straight to creating solutions without understanding the actual issue
- Made assumptions about missing database tables
- Created unnecessary debug scripts and schema files

**✅ What we should do:**
- Ask specific questions about the actual behavior observed
- Test the API endpoints directly before making assumptions
- Verify the current state of the system first

#### 2. Essential Questions to Ask
When someone reports an API issue, always ask:

1. **What specific behavior are you seeing?**
   - Empty responses?
   - Error messages?
   - Wrong data?
   - Timeouts?

2. **What response are you getting?**
   - HTTP status code?
   - Response body content?
   - Error messages?

3. **What data is missing that you expect to see?**
   - Specific fields?
   - Entire records?
   - Related data from joins?

4. **Where is this happening?**
   - Local development?
   - Staging environment?
   - Production?

5. **When did this start?**
   - After a specific deployment?
   - After a configuration change?
   - Intermittent or consistent?

#### 3. Systematic Debugging Approach

**Step 1: Verify Current State**
```bash
# Test API health
curl http://localhost:3001/health

# Test specific endpoint
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost:3001/api/v1/marketplace/installed
```

**Step 2: Check Logs**
- Look for error messages in API server logs
- Check for authentication issues
- Verify database connection status

**Step 3: Test Database Directly**
```bash
# Use debug script to test database queries
node debug-api-logic.js
```

**Step 4: Compare Expected vs Actual**
- What should the response look like?
- What is the actual response?
- What's different?

#### 4. Common API Issues and Solutions

| Issue | Symptoms | Likely Cause | Solution |
|-------|----------|--------------|----------|
| Empty responses | `{"success": true, "data": []}` | No data in database OR Supabase foreign key syntax | Check data population OR fix constraint syntax |
| Silent JOIN failures | 200 OK but empty arrays | Explicit constraint naming in Supabase queries | Use automatic relationship detection |
| Authentication errors | 401 Unauthorized | Invalid API key | Verify API key format |
| Database errors | 500 Internal Server Error | Connection issues | Check database status |
| Slow responses | High response times | Query performance | Check database indexes |

#### 5. Supabase Foreign Key Syntax Issues

**Problem:** Explicit constraint naming in Supabase queries can cause silent failures.

**Bad Syntax:**
```javascript
plugin_marketplace_apps!user_app_installs_app_id_fkey (
  id,
  name
)
```

**Good Syntax:**
```javascript
plugin_marketplace_apps (
  id,
  name
)
```

**Why:** Supabase automatically detects foreign key relationships. Explicit constraint naming is fragile and can fail silently if the constraint name doesn't match exactly.

#### 5. Debugging Tools Available

**Debug Scripts:**
- `debug-api-logic.js` - Comprehensive API logic testing
- `apply-database-schema.js` - Database schema verification

**API Endpoints for Testing:**
- `GET /health` - Basic API health check
- `GET /api/v1/marketplace/installed` - Test user app installations
- `GET /api/v1/marketplace/apps` - Test marketplace app listing

#### 6. Prevention Strategies

**Documentation:**
- Keep API documentation up to date
- Document expected request/response formats
- Include troubleshooting steps in API docs

**Monitoring:**
- Set up API health monitoring
- Log API request/response times
- Monitor database query performance

**Testing:**
- Create automated tests for critical endpoints
- Test with various API keys and user scenarios
- Include edge cases in test coverage

### Quick Reference: API Debugging Checklist

- [ ] Verify API server is running
- [ ] Test health endpoint
- [ ] Check API key format and validity
- [ ] Test specific failing endpoint
- [ ] Compare actual vs expected response
- [ ] Check server logs for errors
- [ ] Verify database connectivity
- [ ] Test with different API keys/users
- [ ] Check for recent deployments/changes

### Conclusion

The most important lesson: **Always understand the problem before trying to solve it**. Ask specific questions, test the current state, and verify assumptions before implementing solutions. This saves time and prevents unnecessary work on non-existent problems.

### Related Files
- `API_BUG_FIX_SUMMARY.md` - Detailed analysis of the recent investigation
- `debug-api-logic.js` - Comprehensive API debugging script
- `internal-docs/supabase-schema.sql` - Complete database schema
