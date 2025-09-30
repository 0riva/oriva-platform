-- Task: T076 - Performance Dashboard Queries
-- Description: SQL queries for performance monitoring and analytics

-- Chat Performance Metrics
-- Aggregate chat response times, token usage, and success rates

CREATE OR REPLACE VIEW analytics_chat_performance AS
SELECT
  DATE_TRUNC('hour', m.created_at) as hour,
  COUNT(*) as total_messages,
  AVG(m.generation_time_ms) as avg_response_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.generation_time_ms) as p95_response_time_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.generation_time_ms) as p99_response_time_ms,
  SUM(m.tokens_used) as total_tokens_used,
  AVG(m.tokens_used) as avg_tokens_per_message,
  AVG(m.confidence_score) as avg_confidence,
  COUNT(CASE WHEN m.generation_time_ms > 5000 THEN 1 END) as slow_responses,
  COUNT(CASE WHEN m.generation_time_ms > 10000 THEN 1 END) as very_slow_responses
FROM messages m
WHERE m.role = 'assistant'
  AND m.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', m.created_at)
ORDER BY hour DESC;

COMMENT ON VIEW analytics_chat_performance IS
'Hourly chat performance metrics including response times and token usage';

-- Knowledge Search Performance
-- Track search latency and result quality

CREATE OR REPLACE VIEW analytics_knowledge_performance AS
SELECT
  DATE_TRUNC('hour', ke.last_accessed_at) as hour,
  ke.category,
  COUNT(*) as total_searches,
  AVG(ke.relevance_score) as avg_relevance,
  COUNT(CASE WHEN ke.relevance_score > 0.8 THEN 1 END) as high_relevance_results,
  COUNT(CASE WHEN ke.relevance_score < 0.5 THEN 1 END) as low_relevance_results,
  AVG(ke.access_count) as avg_access_count
FROM knowledge_entries ke
WHERE ke.last_accessed_at > NOW() - INTERVAL '7 days'
  AND ke.last_accessed_at IS NOT NULL
GROUP BY DATE_TRUNC('hour', ke.last_accessed_at), ke.category
ORDER BY hour DESC, category;

COMMENT ON VIEW analytics_knowledge_performance IS
'Hourly knowledge search performance by category';

-- User Activity Metrics
-- Track active users, conversation patterns, retention

CREATE OR REPLACE VIEW analytics_user_activity AS
SELECT
  DATE_TRUNC('day', u.last_active_at) as day,
  u.subscription_tier,
  COUNT(DISTINCT u.id) as active_users,
  COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '7 days' THEN u.id END) as new_users,
  AVG((
    SELECT COUNT(*)
    FROM conversations c
    WHERE c.user_id = u.id
      AND c.created_at > NOW() - INTERVAL '7 days'
  )) as avg_conversations_per_user,
  AVG((
    SELECT COUNT(*)
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = u.id
      AND m.created_at > NOW() - INTERVAL '7 days'
  )) as avg_messages_per_user
FROM users u
WHERE u.last_active_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', u.last_active_at), u.subscription_tier
ORDER BY day DESC, subscription_tier;

COMMENT ON VIEW analytics_user_activity IS
'Daily user activity metrics by subscription tier';

-- Conversation Engagement Metrics
-- Track conversation length, completion rate, user engagement

CREATE OR REPLACE VIEW analytics_conversation_engagement AS
SELECT
  DATE_TRUNC('day', c.created_at) as day,
  a.domain,
  COUNT(*) as total_conversations,
  AVG(c.message_count) as avg_messages_per_conversation,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY c.message_count) as median_messages,
  COUNT(CASE WHEN c.closed_at IS NOT NULL THEN 1 END) as closed_conversations,
  COUNT(CASE WHEN c.message_count >= 5 THEN 1 END) as engaged_conversations,
  COUNT(CASE WHEN c.message_count < 2 THEN 1 END) as abandoned_conversations,
  AVG(EXTRACT(EPOCH FROM (c.last_message_at - c.created_at))) as avg_duration_seconds
FROM conversations c
JOIN apps a ON a.id = c.app_id
WHERE c.created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', c.created_at), a.domain
ORDER BY day DESC, a.domain;

COMMENT ON VIEW analytics_conversation_engagement IS
'Daily conversation engagement metrics by app domain';

-- Error Rate Monitoring
-- Track errors and failures across different operations

CREATE OR REPLACE VIEW analytics_error_rates AS
SELECT
  DATE_TRUNC('hour', m.created_at) as hour,
  COUNT(*) as total_operations,
  COUNT(CASE WHEN m.confidence_score IS NULL OR m.confidence_score < 0.5 THEN 1 END) as low_confidence_responses,
  ROUND(
    100.0 * COUNT(CASE WHEN m.confidence_score IS NULL OR m.confidence_score < 0.5 THEN 1 END) / NULLIF(COUNT(*), 0),
    2
  ) as error_rate_percentage
FROM messages m
WHERE m.role = 'assistant'
  AND m.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', m.created_at)
ORDER BY hour DESC;

COMMENT ON VIEW analytics_error_rates IS
'Hourly error rates based on confidence scores';

-- Performance SLO Compliance
-- Track compliance with Service Level Objectives

CREATE OR REPLACE VIEW analytics_slo_compliance AS
WITH hourly_metrics AS (
  SELECT
    DATE_TRUNC('hour', m.created_at) as hour,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN m.generation_time_ms <= 1000 THEN 1 END) as fast_responses,
    COUNT(CASE WHEN m.generation_time_ms <= 3000 THEN 1 END) as acceptable_responses,
    AVG(m.confidence_score) as avg_confidence
  FROM messages m
  WHERE m.role = 'assistant'
    AND m.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY DATE_TRUNC('hour', m.created_at)
)
SELECT
  hour,
  total_requests,
  ROUND(100.0 * fast_responses / NULLIF(total_requests, 0), 2) as p95_under_1s_percent,
  ROUND(100.0 * acceptable_responses / NULLIF(total_requests, 0), 2) as p99_under_3s_percent,
  ROUND(avg_confidence * 100, 2) as avg_confidence_percent,
  CASE
    WHEN (100.0 * fast_responses / NULLIF(total_requests, 0)) >= 95.0 THEN 'PASS'
    ELSE 'FAIL'
  END as p95_slo_status,
  CASE
    WHEN (100.0 * acceptable_responses / NULLIF(total_requests, 0)) >= 99.0 THEN 'PASS'
    ELSE 'FAIL'
  END as p99_slo_status
FROM hourly_metrics
ORDER BY hour DESC;

COMMENT ON VIEW analytics_slo_compliance IS
'SLO compliance tracking for performance targets';

-- Token Usage and Costs
-- Track AI token consumption for cost monitoring

CREATE OR REPLACE VIEW analytics_token_usage AS
SELECT
  DATE_TRUNC('day', m.created_at) as day,
  m.model,
  COUNT(*) as total_requests,
  SUM(m.tokens_used) as total_tokens,
  AVG(m.tokens_used) as avg_tokens_per_request,
  MAX(m.tokens_used) as max_tokens,
  -- Estimate costs (adjust rates based on actual pricing)
  CASE m.model
    WHEN 'gpt-4' THEN SUM(m.tokens_used) * 0.00003  -- $0.03 per 1K tokens
    WHEN 'gpt-3.5-turbo' THEN SUM(m.tokens_used) * 0.000002  -- $0.002 per 1K tokens
    ELSE 0
  END as estimated_cost_usd
FROM messages m
WHERE m.role = 'assistant'
  AND m.tokens_used IS NOT NULL
  AND m.created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', m.created_at), m.model
ORDER BY day DESC, model;

COMMENT ON VIEW analytics_token_usage IS
'Daily AI token usage and estimated costs by model';

-- Top Slow Queries
-- Identify slowest operations for optimization

CREATE OR REPLACE VIEW analytics_slow_operations AS
SELECT
  m.id as message_id,
  m.conversation_id,
  m.generation_time_ms,
  m.tokens_used,
  m.model,
  m.confidence_score,
  m.created_at,
  LENGTH(m.content) as response_length,
  (
    SELECT COUNT(*)
    FROM messages m2
    WHERE m2.conversation_id = m.conversation_id
      AND m2.created_at <= m.created_at
  ) as conversation_message_count
FROM messages m
WHERE m.role = 'assistant'
  AND m.generation_time_ms > 5000
  AND m.created_at > NOW() - INTERVAL '7 days'
ORDER BY m.generation_time_ms DESC
LIMIT 100;

COMMENT ON VIEW analytics_slow_operations IS
'Slowest operations in the last 7 days for performance investigation';

-- Grant read access to analytics role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON analytics_chat_performance TO anon, authenticated;
GRANT SELECT ON analytics_knowledge_performance TO anon, authenticated;
GRANT SELECT ON analytics_user_activity TO anon, authenticated;
GRANT SELECT ON analytics_conversation_engagement TO anon, authenticated;
GRANT SELECT ON analytics_error_rates TO anon, authenticated;
GRANT SELECT ON analytics_slo_compliance TO anon, authenticated;
GRANT SELECT ON analytics_token_usage TO anon, authenticated;
GRANT SELECT ON analytics_slow_operations TO anon, authenticated;