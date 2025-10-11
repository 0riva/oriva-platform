#!/bin/bash
# Fix all migrations to be idempotent by wrapping constraints in IF NOT EXISTS

for file in supabase/migrations/20250114*.sql; do
  echo "Processing $file..."

  # Create backup
  cp "$file" "$file.bak"

  # Use sed to find ALTER TABLE...ADD CONSTRAINT and wrap in DO block
  # This is a simple approach - for production you'd want more sophisticated parsing

  python3 <<'PYTHON_SCRIPT'
import sys
import re

file_path = sys.argv[1]

with open(file_path, 'r') as f:
    content = f.read()

# Pattern to match ALTER TABLE ... ADD CONSTRAINT statements
pattern = r'ALTER TABLE (\w+) ADD CONSTRAINT (\w+)\s+([^;]+);'

def replace_constraint(match):
    table = match.group(1)
    constraint_name = match.group(2)
    check_clause = match.group(3)

    return f"""DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{constraint_name}') THEN
    ALTER TABLE {table} ADD CONSTRAINT {constraint_name}
      {check_clause};
  END IF;
END $$;"""

# Replace all occurrences
new_content = re.sub(pattern, replace_constraint, content, flags=re.MULTILINE | re.DOTALL)

# Write back
with open(file_path, 'w') as f:
    f.write(new_content)

print(f"Fixed {file_path}")
PYTHON_SCRIPT
python3 - "$file"

done

echo "All migrations fixed!"
