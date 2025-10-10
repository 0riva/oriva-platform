#!/bin/bash
# Sync local Supabase from production schema (source of truth approach)
# This replaces manual migration management with production schema extraction

set -e

echo "🔄 Production-as-Source-of-Truth Workflow"
echo "=========================================="
echo ""

# 1. Stop local Supabase if running
echo "1️⃣ Stopping local Supabase..."
cd /Users/cosmic/Documents/oriva-platform
supabase stop || true
echo ""

# 2. Backup existing migrations
echo "2️⃣ Backing up existing migrations..."
if [ -d "supabase/migrations" ]; then
  BACKUP_DIR="supabase/migrations.backup-$(date +%Y%m%d-%H%M%S)"
  mv supabase/migrations "$BACKUP_DIR"
  echo "   ✅ Backed up to: $BACKUP_DIR"
fi
mkdir -p supabase/migrations
echo ""

# 3. Pull complete schema from production
echo "3️⃣ Pulling complete schema from production..."
echo "   This extracts the ACTUAL production database state"
echo "   (not what we think it should be from migration files)"
echo ""
supabase db pull --schema public
echo ""

# 4. Start local Supabase with production schema
echo "4️⃣ Starting local Supabase with production schema..."
supabase start
echo ""

# 4.5. Restart PostgREST to reload schema cache
echo "4️⃣.5 Restarting PostgREST to reload schema cache..."
docker restart supabase_rest_oriva-platform
sleep 2  # Give PostgREST time to reload
echo "   ✅ PostgREST schema cache refreshed"
echo ""

# 5. Verify tables match production
echo "5️⃣ Verifying local now matches production..."
LOCAL_TABLES=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "   Local tables: $LOCAL_TABLES"
echo ""

echo "✅ Local Supabase now synced with production!"
echo ""
echo "Next steps:"
echo "  1. Create test user: ./scripts/create-test-user.sh"
echo "  2. Test app functionality"
echo ""
echo "ℹ️  Benefits of this approach:"
echo "  - Local always matches production exactly"
echo "  - No migration drift or sync issues"
echo "  - Simple: run this script whenever production changes"
echo ""
echo "⚠️  Tradeoffs:"
echo "  - Lose granular migration history"
echo "  - Can't track individual schema changes over time"
echo "  - Requires production access to refresh local"
