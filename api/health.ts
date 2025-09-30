// Health check endpoint for monitoring
// Task: Support for T073-T077 monitoring phase

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from './config/supabase';
import { getMetricsSummary } from './lib/metrics';
import { getAlertHealthStatus, getAlertSummary } from './lib/alerts';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const supabase = getSupabaseClient();
    const { error: dbError } = await supabase
      .from('apps')
      .select('id')
      .limit(1)
      .single();

    const dbHealthy = !dbError;
    const responseTime = Date.now() - startTime;

    // Check environment variables
    const envHealthy = !!(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.OPENAI_API_KEY
    );

    // Get alert status
    const alertStatus = getAlertHealthStatus();
    const alertSummary = getAlertSummary(15 * 60 * 1000); // Last 15 minutes

    // Get performance metrics (last 5 minutes)
    const metrics = getMetricsSummary(5 * 60 * 1000);

    const healthy = dbHealthy && envHealthy && alertStatus.healthy;

    // Return different status codes based on health
    const statusCode = healthy ? 200 : alertStatus.criticalAlerts > 0 ? 503 : 500;

    res.status(statusCode).json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        environment: envHealthy ? 'healthy' : 'unhealthy',
        alerts: alertStatus.healthy ? 'healthy' : 'unhealthy',
      },
      alerts: {
        critical: alertStatus.criticalAlerts,
        errors: alertStatus.errorAlerts,
        warnings: alertStatus.warningAlerts,
        summary: alertSummary,
      },
      metrics: {
        chat_response_time_p95: metrics['chat.response_time']?.p95 || 0,
        chat_response_time_avg: metrics['chat.response_time']?.avg || 0,
        knowledge_search_latency_avg: metrics['knowledge.search_latency']?.avg || 0,
        api_response_time_p95: metrics['api.response_time']?.p95 || 0,
        database_query_time_avg: metrics['database.query_time']?.avg || 0,
        tokens_used_total: metrics['ai.tokens_used']?.sum || 0,
      },
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}