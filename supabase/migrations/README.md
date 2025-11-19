# Migration Directory - Historical Archive

## ⚠️ Important: Migrations Now Managed in o-core

**As of November 11, 2025**, all database migrations are now managed in the **o-core** repository, not o-platform.

### Current Migration Location

**Authoritative migrations**: `/Users/cosmic/o-core/supabase/migrations/`

All new migrations should be created in **o-core**, not o-platform.

### Why the Change?

Production database was reset using clean alpha foundation migrations from o-core:

- `20251111000000_alpha_foundation.sql`
- `20251111000001_alpha_additions.sql`
- `20251111140444_add_historical_context.sql`

These migrations consolidated 89+ previous migrations into a clean baseline.

### What's in This Directory?

- **`archive/pre-alpha-reset/`**: 38 historical migration files from before the alpha reset
  - These are kept for reference only
  - They are NOT part of the current migration history
  - Do NOT use these for new migrations

### Creating New Migrations

**✅ DO THIS:**

```bash
cd /Users/cosmic/o-core
supabase migration new your_migration_name
# Edit the migration file in o-core/supabase/migrations/
```

**❌ DON'T DO THIS:**

```bash
cd /Users/cosmic/o-platform
supabase migration new ...  # ❌ Wrong location
```

### Deploying Migrations

Migrations are deployed from o-core:

```bash
cd /Users/cosmic/o-core
supabase db push --linked  # Deploy to production
```

### Migration Status

Check migration status from o-core:

```bash
cd /Users/cosmic/o-core
supabase migration list --linked
```

---

**Last Updated**: 2025-11-11  
**Migration Authority**: o-core repository  
**Contact**: Oriva Development Team

