// Health check endpoint for monitoring
// Task: Support for T073-T077 monitoring phase

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from './config/supabase';

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

    const healthy = dbHealthy && envHealthy;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        environment: envHealthy ? 'healthy' : 'unhealthy',
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