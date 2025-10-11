#!/bin/bash
# Quick helper to reload PostgREST schema cache
# Run this after any manual migration or schema change

set -e

echo "🔄 Reloading PostgREST Schema Cache"
echo "===================================="
echo ""

# Restart PostgREST container
echo "Restarting PostgREST..."
docker restart supabase_rest_oriva-platform

echo ""
echo "⏳ Waiting for PostgREST to reload..."
sleep 2

echo ""
echo "✅ PostgREST schema cache reloaded!"
echo ""
echo "ℹ️  Why this is needed:"
echo "  PostgREST caches database schema at startup"
echo "  After migrations/schema changes, it needs a restart"
echo "  Otherwise you'll get 404 errors on new tables/columns"
echo ""
