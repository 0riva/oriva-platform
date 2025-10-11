#!/bin/bash
# Fix PostgREST JWT secret format to match Auth service
# This is a workaround for Supabase CLI JWK format bug

set -e

echo "🔧 Fixing PostgREST JWT secret format..."

# Stop Supabase
echo "Stopping Supabase..."
cd /Users/cosmic/Documents/oriva-platform
supabase stop

# Get the plain JWT secret
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

echo "Updating docker-compose override..."

# Create docker-compose override to fix JWT secret
cat > /Users/cosmic/Documents/oriva-platform/supabase/docker-compose-override.yml << EOF
# Override PostgREST JWT secret to use plain format instead of JWK
# This fixes the JWT validation issue with authenticated user tokens
version: '3.8'
services:
  rest:
    environment:
      PGRST_JWT_SECRET: "${JWT_SECRET}"
EOF

echo "Restarting Supabase with fixed configuration..."
supabase start

echo ""
echo "✅ PostgREST JWT secret fixed!"
echo ""
echo "The JWT secret is now in plain format matching the Auth service."
echo "Please log out and log back in to get a fresh JWT, then try creating a group."
