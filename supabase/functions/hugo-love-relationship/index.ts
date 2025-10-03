// Hugo Love: Consolidated Relationship Features API
// Endpoints: Goals, Journal Entries, Analytics/Health Scores
// Aligns with specs/004-hugo-love-app/contracts/

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean).slice(1); // Remove 'hugo-love-relationship'

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate handler
    switch (path[0]) {
      case 'goals':
        return await handleGoals(req, supabaseClient, user, path.slice(1));
      case 'journal':
        return await handleJournal(req, supabaseClient, user, path.slice(1));
      case 'analytics':
        return await handleAnalytics(req, supabaseClient, user, path.slice(1));
      case 'subscriptions':
        return await handleSubscriptions(req, supabaseClient, user, path.slice(1));
      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================================
// GOALS
// ============================================================================

async function handleGoals(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /goals - Get user's goals
  if (method === 'GET' && path.length === 0) {
    const url = new URL(req.url);
    const includeShared = url.searchParams.get('include_shared') === 'true';

    let query = supabaseClient
      .from('hugo_love.goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({ goals: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /goals - Create new goal
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const {
      title,
      description,
      target_date,
      is_shared_with_partner,
      partner_connection_id,
      category,
    } = body;

    const { data, error } = await supabaseClient
      .from('hugo_love.goals')
      .insert({
        user_id: user.id,
        title,
        description,
        target_date,
        is_shared_with_partner,
        partner_connection_id,
        category,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ goal: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // PATCH /goals/:id - Update goal progress
  if (method === 'PATCH' && path.length === 1) {
    const goalId = path[0];
    const body = await req.json();
    const { current_progress, is_completed } = body;

    const { data, error } = await supabaseClient
      .from('hugo_love.goals')
      .update({ current_progress, is_completed })
      .eq('id', goalId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ goal: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // DELETE /goals/:id - Delete goal
  if (method === 'DELETE' && path.length === 1) {
    const goalId = path[0];

    const { error } = await supabaseClient
      .from('hugo_love.goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// JOURNAL
// ============================================================================

async function handleJournal(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /journal - Get user's journal entries
  if (method === 'GET' && path.length === 0) {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const { data, error } = await supabaseClient
      .from('hugo_love.journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({ journal_entries: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /journal - Create new journal entry
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const { title, content, mood, is_shared_with_partner, partner_connection_id, tags } = body;

    const { data, error } = await supabaseClient
      .from('hugo_love.journal_entries')
      .insert({
        user_id: user.id,
        title,
        content,
        mood,
        is_shared_with_partner,
        partner_connection_id,
        tags,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ journal_entry: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // DELETE /journal/:id - Delete journal entry
  if (method === 'DELETE' && path.length === 1) {
    const entryId = path[0];

    const { error } = await supabaseClient
      .from('hugo_love.journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// ANALYTICS (Relationship Health Scores)
// ============================================================================

async function handleAnalytics(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /analytics/health-score - Calculate relationship health score
  if (method === 'GET' && path.length === 1 && path[0] === 'health-score') {
    const url = new URL(req.url);
    const partner_connection_id = url.searchParams.get('partner_connection_id');

    const healthScore = await calculateHealthScore(supabaseClient, user.id, partner_connection_id);

    return new Response(JSON.stringify({ health_score: healthScore }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET /analytics/insights - Get relationship insights
  if (method === 'GET' && path.length === 1 && path[0] === 'insights') {
    const url = new URL(req.url);
    const partner_connection_id = url.searchParams.get('partner_connection_id');

    const insights = await generateInsights(supabaseClient, user.id, partner_connection_id);

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

async function handleSubscriptions(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /subscriptions - Get user's active subscription
  if (method === 'GET' && path.length === 0) {
    const { data, error } = await supabaseClient
      .from('hugo_love.subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    return new Response(JSON.stringify({ subscription: data || null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /subscriptions - Create new subscription
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const { tier, billing_cycle, stripe_subscription_id, stripe_customer_id } = body;

    // Calculate expires_at based on billing_cycle
    let expires_at = null;
    if (billing_cycle === 'monthly') {
      expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (billing_cycle === 'yearly') {
      expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
    // lifetime = null expires_at

    const { data, error } = await supabaseClient
      .from('hugo_love.subscriptions')
      .insert({
        user_id: user.id,
        tier,
        billing_cycle,
        stripe_subscription_id,
        stripe_customer_id,
        expires_at,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ subscription: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// ANALYTICS HELPERS (4-factor health score calculation)
// ============================================================================

async function calculateHealthScore(supabaseClient, userId, partnerConnectionId) {
  // Factor 1: Communication Quality (0-100)
  const communicationScore = await calculateCommunicationScore(
    supabaseClient,
    userId,
    partnerConnectionId
  );

  // Factor 2: Goal Alignment (0-100)
  const goalAlignmentScore = await calculateGoalAlignmentScore(
    supabaseClient,
    userId,
    partnerConnectionId
  );

  // Factor 3: Emotional Intimacy (0-100)
  const emotionalIntimacyScore = await calculateEmotionalIntimacyScore(supabaseClient, userId);

  // Factor 4: Conflict Resolution (0-100)
  const conflictResolutionScore = await calculateConflictResolutionScore(supabaseClient, userId);

  const overallScore = Math.round(
    (communicationScore + goalAlignmentScore + emotionalIntimacyScore + conflictResolutionScore) / 4
  );

  return {
    overall: overallScore,
    communication: communicationScore,
    goal_alignment: goalAlignmentScore,
    emotional_intimacy: emotionalIntimacyScore,
    conflict_resolution: conflictResolutionScore,
  };
}

async function calculateCommunicationScore(supabaseClient, userId, partnerConnectionId) {
  let score = 50; // Base score

  if (partnerConnectionId) {
    // Count shared journal entries (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count } = await supabaseClient
      .from('hugo_love.journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_shared_with_partner', true)
      .gte('created_at', thirtyDaysAgo.toISOString());

    score += Math.min(30, (count || 0) * 3); // Cap at +30

    // Check for recent communication (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count: recentCount } = await supabaseClient
      .from('hugo_love.journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_shared_with_partner', true)
      .gte('created_at', sevenDaysAgo.toISOString());

    if ((recentCount || 0) >= 2) {
      score += 20; // Bonus for regular communication
    }
  }

  return Math.min(100, score);
}

async function calculateGoalAlignmentScore(supabaseClient, userId, partnerConnectionId) {
  let score = 50; // Base score

  if (partnerConnectionId) {
    // Count shared goals
    const { count: sharedGoalsCount } = await supabaseClient
      .from('hugo_love.goals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_shared_with_partner', true);

    score += Math.min(25, (sharedGoalsCount || 0) * 5); // Cap at +25

    // Count active shared goals with progress
    const { data: activeGoals } = await supabaseClient
      .from('hugo_love.goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_shared_with_partner', true)
      .eq('is_completed', false)
      .gt('current_progress', 0);

    score += Math.min(25, (activeGoals?.length || 0) * 5); // Cap at +25
  }

  return Math.min(100, score);
}

async function calculateEmotionalIntimacyScore(supabaseClient, userId) {
  let score = 50; // Base score

  // Count journal entries (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: entries } = await supabaseClient
    .from('hugo_love.journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const entryCount = entries?.length || 0;
  score += Math.min(20, entryCount * 2); // Cap at +20

  // Mood diversity
  const moodSet = new Set((entries || []).map((e) => e.mood).filter(Boolean));
  score += Math.min(15, moodSet.size * 3); // Cap at +15

  // Entry depth (average length)
  if (entries && entries.length > 0) {
    const avgLength = entries.reduce((sum, e) => sum + e.content.length, 0) / entries.length;
    if (avgLength > 500) {
      score += 15;
    } else if (avgLength > 200) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

async function calculateConflictResolutionScore(supabaseClient, userId) {
  let score = 60; // Base score (optimistic default)

  // Find journal entries with difficult/challenging moods
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: allEntries } = await supabaseClient
    .from('hugo_love.journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  const difficultEntries =
    allEntries?.filter((e) => e.mood === 'difficult' || e.mood === 'challenging') || [];

  // Check for mood recovery after difficult entries
  for (const entry of difficultEntries) {
    const laterEntries = allEntries?.filter(
      (e) => new Date(e.created_at) > new Date(entry.created_at)
    );
    const nextEntry = laterEntries?.[0];
    if (nextEntry && (nextEntry.mood === 'good' || nextEntry.mood === 'great')) {
      score += 5; // Bonus for mood recovery
    }
  }

  return Math.min(100, score);
}

async function generateInsights(supabaseClient, userId, partnerConnectionId) {
  const insights = [];

  const healthScore = await calculateHealthScore(supabaseClient, userId, partnerConnectionId);

  // Communication insights
  if (healthScore.communication < 50) {
    insights.push({
      category: 'communication',
      title: 'Improve Communication',
      message: 'Try sharing more journal entries with your partner to strengthen your connection.',
      actionable: true,
    });
  }

  // Goal alignment insights
  if (healthScore.goal_alignment < 50) {
    insights.push({
      category: 'goals',
      title: 'Set Shared Goals',
      message: 'Creating shared relationship goals can increase your alignment and partnership.',
      actionable: true,
    });
  }

  // Emotional intimacy insights
  if (healthScore.emotional_intimacy < 60) {
    insights.push({
      category: 'emotional',
      title: 'Deepen Emotional Connection',
      message: 'Regular journaling can help you understand and express your emotions better.',
      actionable: true,
    });
  }

  // Positive reinforcement
  if (healthScore.overall >= 80) {
    insights.push({
      category: 'general',
      title: 'Great Work!',
      message: 'Your relationship health score is excellent. Keep up the great communication!',
      actionable: false,
    });
  }

  return insights;
}
