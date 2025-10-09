#!/bin/bash
# verify-message-persistence.sh
# Database verification script for Hugo Love message persistence (T049)
#
# Validates:
# - Messages saved to database after chat
# - tic_chunk_ids populated from RAG search
# - Conversation metadata correct
# - Timestamps and user associations

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection
DB_HOST="127.0.0.1"
DB_PORT="54322"
DB_USER="postgres"
DB_NAME="postgres"
export PGPASSWORD="postgres"

echo "=========================================="
echo "Hugo Love - Message Persistence Verification"
echo "=========================================="
echo ""

# Test user and conversation IDs
TEST_USER_ID="00000000-0000-0000-0000-000000000001"
TEST_CONVERSATION_ID="00000000-0000-0000-0000-000000000010"

echo "📊 Database Statistics"
echo "----------------------------------------"

# Check total message count
TOTAL_MESSAGES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM hugo_love.messages;
" | xargs)

echo "Total Messages: $TOTAL_MESSAGES"

# Check messages with RAG chunks
MESSAGES_WITH_CHUNKS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM hugo_love.messages WHERE tic_chunk_ids IS NOT NULL;
" | xargs)

echo "Messages with RAG Chunks: $MESSAGES_WITH_CHUNKS"

# Check test conversation
TEST_CONV_MESSAGES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM hugo_love.messages WHERE conversation_id = '$TEST_CONVERSATION_ID';
" | xargs)

echo "Test Conversation Messages: $TEST_CONV_MESSAGES"
echo ""

# Detailed message inspection
echo "🔍 Recent Messages (Last 5)"
echo "----------------------------------------"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    id,
    LEFT(content, 50) as content_preview,
    role,
    array_length(tic_chunk_ids, 1) as chunk_count,
    created_at
FROM hugo_love.messages
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "🎯 Test Conversation Details"
echo "----------------------------------------"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    c.id,
    c.title,
    c.current_stage,
    c.created_at,
    COUNT(m.id) as message_count
FROM hugo_love.conversations c
LEFT JOIN hugo_love.messages m ON m.conversation_id = c.id
WHERE c.id = '$TEST_CONVERSATION_ID'
GROUP BY c.id, c.title, c.current_stage, c.created_at;
"

echo ""
echo "📝 RAG Chunk Attribution"
echo "----------------------------------------"

# Show which TIC chunks were used in responses
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    m.id as message_id,
    LEFT(m.content, 40) as message_preview,
    array_length(m.tic_chunk_ids, 1) as num_chunks,
    (
        SELECT string_agg(dc.metadata->>'workbookTitle', ', ')
        FROM hugo_love.document_chunks dc
        WHERE dc.id = ANY(m.tic_chunk_ids)
        LIMIT 3
    ) as tic_sources
FROM hugo_love.messages m
WHERE m.tic_chunk_ids IS NOT NULL
  AND m.role = 'assistant'
ORDER BY m.created_at DESC
LIMIT 5;
"

echo ""
echo "⏱️  Message Timing Analysis"
echo "----------------------------------------"

# Check time between messages (should be reasonable for streaming)
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT
    role,
    LEFT(content, 30) as content,
    created_at,
    created_at - LAG(created_at) OVER (ORDER BY created_at) as time_since_prev
FROM hugo_love.messages
WHERE conversation_id = '$TEST_CONVERSATION_ID'
ORDER BY created_at DESC
LIMIT 10;
"

echo ""
echo "✅ Validation Checks"
echo "----------------------------------------"

# Validation 1: Check if test conversation exists
if [ "$TEST_CONV_MESSAGES" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Test conversation has messages"
else
    echo -e "${YELLOW}⚠${NC}  Test conversation has no messages (chat not tested yet)"
fi

# Validation 2: Check if RAG chunks are being used
if [ "$MESSAGES_WITH_CHUNKS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} RAG chunks are being attached to messages"

    # Calculate percentage
    if [ "$TOTAL_MESSAGES" -gt 0 ]; then
        CHUNK_PERCENTAGE=$((MESSAGES_WITH_CHUNKS * 100 / TOTAL_MESSAGES))
        echo -e "  → ${CHUNK_PERCENTAGE}% of messages have RAG context"
    fi
else
    echo -e "${YELLOW}⚠${NC}  No messages have RAG chunks attached (verify RAG pipeline)"
fi

# Validation 3: Check for orphaned messages (no conversation)
ORPHANED_MESSAGES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM hugo_love.messages m
WHERE NOT EXISTS (
    SELECT 1 FROM hugo_love.conversations c WHERE c.id = m.conversation_id
);
" | xargs)

if [ "$ORPHANED_MESSAGES" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No orphaned messages (all have valid conversations)"
else
    echo -e "${RED}✗${NC} Found $ORPHANED_MESSAGES orphaned messages"
fi

# Validation 4: Check for proper user association
UNASSOCIATED_CONVS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM hugo_love.conversations c
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = c.user_id
);
" | xargs)

if [ "$UNASSOCIATED_CONVS" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All conversations have valid user associations"
else
    echo -e "${RED}✗${NC} Found $UNASSOCIATED_CONVS conversations without users"
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="

# Summary
echo ""
echo "Summary:"
echo "  Total Messages: $TOTAL_MESSAGES"
echo "  With RAG Chunks: $MESSAGES_WITH_CHUNKS"
echo "  Test Conversation: $TEST_CONV_MESSAGES messages"
echo ""

if [ "$MESSAGES_WITH_CHUNKS" -gt 0 ] && [ "$ORPHANED_MESSAGES" -eq 0 ]; then
    echo -e "${GREEN}✅ Database persistence verification PASSED${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Database verification needs attention${NC}"
    exit 1
fi
