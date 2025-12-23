# Love Puzl (Hugo Love) Profile SQL Patterns

## Overview

The Love Puzl profile API uses raw SQL via `exec_sql` RPC to interact with the `hugo_love.dating_profiles` table. This document captures the correct patterns for SQL serialization based on the **production database schema**.

---

## Production Database Schema

**CRITICAL**: The production schema may differ from migration files. Always verify against production.

```sql
-- hugo_love.dating_profiles column types (PRODUCTION)
CREATE TABLE hugo_love.dating_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,

  -- Scalar fields
  display_name VARCHAR(100),
  bio TEXT,
  birth_month INTEGER,
  birth_year INTEGER,
  age INTEGER,
  age_range_min INTEGER,
  age_range_max INTEGER,
  distance_max_km INTEGER,
  whatsapp_number VARCHAR(50),
  instagram_url VARCHAR(255),
  linkedin_url VARCHAR(255),
  twitter_url VARCHAR(255),
  gender VARCHAR(50),
  height_cm INTEGER,
  ethnicity VARCHAR(100),
  seeking_height_min INTEGER,
  seeking_height_max INTEGER,
  is_verified BOOLEAN,
  is_premium BOOLEAN,

  -- JSONB fields (use sqlQuoteJsonb)
  location JSONB,

  -- TEXT[] fields (use sqlQuoteTextArray)
  interests TEXT[],
  looks TEXT[],
  personality TEXT[],
  lifestyle TEXT[],
  profile_photos TEXT[],        -- NOT JSONB!
  profile_videos TEXT[],        -- NOT JSONB!
  seeking_genders TEXT[],
  seeking_ethnicities TEXT[],
  seeking_interests TEXT[],

  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## SQL Serialization Helpers

### sqlQuote (scalars)

For strings, numbers, booleans, null:

```typescript
const sqlQuote = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object')
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::JSONB`;
  return `'${String(val).replace(/'/g, "''")}'`;
};
```

### sqlQuoteJsonb (JSONB columns)

For `location` field only:

```typescript
const sqlQuoteJsonb = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::JSONB`;
};
```

**Output examples:**

- `sqlQuoteJsonb("Merida")` → `'"Merida"'::JSONB`
- `sqlQuoteJsonb({city: "Merida", lat: 20.97})` → `'{"city":"Merida","lat":20.97}'::JSONB`
- `sqlQuoteJsonb(null)` → `NULL`

### sqlQuoteTextArray (TEXT[] columns)

For all array fields:

```typescript
const sqlQuoteTextArray = (val: any): string => {
  if (
    val === null ||
    val === undefined ||
    !Array.isArray(val) ||
    val.length === 0
  )
    return "'{}'::TEXT[]";
  return `ARRAY[${val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')}]::TEXT[]`;
};
```

**Output examples:**

- `sqlQuoteTextArray([])` → `'{}'::TEXT[]`
- `sqlQuoteTextArray(['music', 'travel'])` → `ARRAY['music','travel']::TEXT[]`
- `sqlQuoteTextArray(['https://cdn.com/photo.jpg'])` → `ARRAY['https://cdn.com/photo.jpg']::TEXT[]`

---

## Correct Usage by Field

| Field               | Type    | Helper            | Example Output                 |
| ------------------- | ------- | ----------------- | ------------------------------ |
| display_name        | VARCHAR | sqlQuote          | `'John'`                       |
| bio                 | TEXT    | sqlQuote          | `'Hello world'`                |
| age                 | INTEGER | sqlQuote          | `30`                           |
| location            | JSONB   | sqlQuoteJsonb     | `'"Merida"'::JSONB`            |
| interests           | TEXT[]  | sqlQuoteTextArray | `ARRAY['music']::TEXT[]`       |
| looks               | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |
| personality         | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |
| lifestyle           | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |
| profile_photos      | TEXT[]  | sqlQuoteTextArray | `ARRAY['https://...']::TEXT[]` |
| profile_videos      | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |
| seeking_genders     | TEXT[]  | sqlQuoteTextArray | `ARRAY['female']::TEXT[]`      |
| seeking_ethnicities | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |
| seeking_interests   | TEXT[]  | sqlQuoteTextArray | `'{}'::TEXT[]`                 |

---

## Anti-Patterns

### 1. Using JSONB for TEXT[] columns

```typescript
// WRONG - profile_photos is TEXT[], not JSONB
updates.push(`profile_photos = '["url1","url2"]'::JSONB`);

// Error: column "profile_photos" is of type text[] but expression is of type jsonb
```

### 2. Using TEXT[] syntax for JSONB columns

```typescript
// WRONG - location is JSONB
updates.push(`location = ARRAY['Merida']::TEXT[]`);

// Error: column "location" is of type jsonb but expression is of type text[]
```

### 3. Inserting plain strings into JSONB columns

```typescript
// WRONG - "Merida" is not valid JSON
updates.push(`location = 'Merida'`);

// Error: invalid input syntax for type json
```

### 4. Trusting migration files over production schema

```typescript
// WRONG - Migration says JSONB but production has TEXT[]
// migration: profile_photos JSONB DEFAULT '[]'::jsonb
// production: profile_photos TEXT[] DEFAULT '{}'

// ALWAYS verify against production database
```

### 5. Using generic array handler for all arrays

```typescript
// WRONG - One size does NOT fit all
if (Array.isArray(val)) {
  return `'${JSON.stringify(val)}'::JSONB`; // Breaks TEXT[] columns
}
```

---

## Debugging

### Check SQL being generated

The profile PATCH endpoint logs SQL for debugging:

```typescript
console.log('[PATCH /me] DEBUG sql execution:', {
  profileId,
  updatedFields,
  sqlLength: sql.length,
  includesProfilePhotos: sql.includes('profile_photos'),
  sqlSnippet: sql.substring(0, 500),
});
```

### Common errors and causes

| Error                                                        | Cause                          | Fix                                     |
| ------------------------------------------------------------ | ------------------------------ | --------------------------------------- |
| `invalid input syntax for type json`                         | Plain string in JSONB column   | Use `sqlQuoteJsonb` with JSON.stringify |
| `column X is of type text[] but expression is of type jsonb` | JSONB syntax for TEXT[] column | Use `sqlQuoteTextArray`                 |
| `column X is of type jsonb but expression is of type text[]` | TEXT[] syntax for JSONB column | Use `sqlQuoteJsonb`                     |

### Verify production schema

```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'hugo_love'
  AND table_name = 'dating_profiles';
```

---

## Future Improvements

1. **Location field**: Should be map-integrated lookup storing:

   ```jsonb
   {
     "formatted_address": "Merida, Yucatan, Mexico",
     "lat": 20.9674,
     "lng": -89.5926,
     "place_id": "ChIJ..."
   }
   ```

2. **Schema sync**: Ensure migration files match production schema

3. **Type safety**: Consider using Prisma or Drizzle for type-safe queries

---

## References

- Profile endpoint: `src/express/routes/hugo-love/profiles.ts`
- Database: `hugo_love.dating_profiles` table
- Production: OrivaDB (Supabase)
