#!/bin/bash
# Fix JWT configuration mismatch between Auth and PostgREST
# NON-DESTRUCTIVE: Just restarts services without losing data

set -e

echo "🔧 Fixing JWT configuration (non-destructive restart)..."
echo ""

# Stop Supabase
echo "Stopping Supabase..."
supabase stop

# Start with fresh config
echo "Starting Supabase..."
supabase start

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 5

# Verify JWT config
echo ""
echo "Verifying JWT configuration..."
AUTH_SECRET=$(docker exec supabase_auth_oriva-platform env | grep GOTRUE_JWT_SECRET | cut -d= -f2)
PGRST_SECRET=$(docker exec supabase_rest_oriva-platform env | grep PGRST_JWT_SECRET)

echo "Auth JWT Secret: ${AUTH_SECRET:0:20}..."
echo "PostgREST JWT Config: ${PGRST_SECRET:0:50}..."
echo ""

echo "✅ Supabase restarted (data preserved)!"
echo ""
echo "If the issue persists after login, the JWT format mismatch remains."
echo "You may need a full reset - see README for instructions."
echo ""
echo "Please log back in and try creating a group."
