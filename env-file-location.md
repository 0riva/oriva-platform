# Environment File Locations

## Current Setup

The Oriva Platform project has environment files in two locations:

### Primary Environment File
- **Location**: `/.env` (project root)
- **Purpose**: Main environment configuration for the entire project
- **Contains**: Supabase configuration, API settings, development variables

### API Server Environment File
- **Location**: `/api/.env` (API directory)
- **Purpose**: Copy of root .env file specifically for the API server
- **Reason**: The API server runs from the `/api` directory and needs local access to environment variables

## Why Two Files?

The API server (`/api/index.js`) uses `require('dotenv').config()` which loads `.env` from the current working directory. When running the API server with `cd api && node index.js`, it looks for `.env` in the `/api` directory, not the project root.

## Keeping Files in Sync

When updating environment variables:
1. Update the primary file: `/.env`
2. Copy changes to API directory: `cp .env api/.env`

## Work Buddy Team Note

The API server is now running at `http://localhost:3001` with all required endpoints:
- ✅ `/api/v1/health`
- ✅ `/api/v1/sessions`
- ✅ `/api/v1/groups`
- ✅ `/api/v1/users/me` (added for compatibility)
- ✅ `/api/v1/auth/profile`
- ✅ `/api/v1/team/members`
- ✅ `/api/v1/sessions/upcoming`
- ✅ `/api/v1/analytics/summary`

All endpoints now return proper JSON responses instead of 404 errors.