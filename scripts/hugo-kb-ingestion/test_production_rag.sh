#!/bin/bash
# T051-T053: Verify Production RAG Integration
# Tests that chat-stream Edge Function retrieves relevant TIC chunks

EDGE_FUNCTION_URL="https://cbzgvlkizkdfjmbrosav.supabase.co/functions/v1/chat-stream"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg"

echo "🧪 Testing Production RAG Integration"
echo "======================================"

# Test 1: Celebration stage query
echo -e "\n📍 Test 1: Celebration Stage"
echo "Query: How do I celebrate being single?"
curl -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I celebrate being single and enjoy my independence?",
    "conversationId": "test-conv-1",
    "userId": "test-user",
    "coachingContext": {
      "currentStage": "celebration",
      "preferredTone": "friendly"
    }
  }' 2>&1 | head -50

echo -e "\n\n📍 Test 2: Connection Stage"
echo "Query: What should I look for in a partner?"
curl -X POST "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What qualities should I look for in a potential partner?",
    "conversationId": "test-conv-2",
    "userId": "test-user",
    "coachingContext": {
      "currentStage": "connection",
      "preferredTone": "supportive"
    }
  }' 2>&1 | head -50

echo -e "\n\n✅ Production RAG test complete"
