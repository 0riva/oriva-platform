// Hugo Love: Consolidated Dating Features API
// Endpoints: Matching, Ratings, Messaging, Video Dates
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
    const path = url.pathname.split('/').filter(Boolean).slice(1); // Remove 'hugo-love-dating'

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
      case 'profiles':
        return await handleProfiles(req, supabaseClient, user, path.slice(1));
      case 'ratings':
        return await handleRatings(req, supabaseClient, user, path.slice(1));
      case 'matches':
        return await handleMatches(req, supabaseClient, user, path.slice(1));
      case 'conversations':
        return await handleConversations(req, supabaseClient, user, path.slice(1));
      case 'messages':
        return await handleMessages(req, supabaseClient, user, path.slice(1));
      case 'video-dates':
        return await handleVideoDates(req, supabaseClient, user, path.slice(1));
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
// PROFILES
// ============================================================================

async function handleProfiles(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /profiles - Get random profiles for swiping
  if (method === 'GET' && path.length === 0) {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const { data, error } = await supabaseClient
      .from('hugo_love.profiles')
      .select('*')
      .neq('user_id', user.id)
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({ profiles: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET /profiles/:id - Get specific profile
  if (method === 'GET' && path.length === 1) {
    const profileId = path[0];

    const { data, error } = await supabaseClient
      .from('hugo_love.profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ profile: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// RATINGS
// ============================================================================

async function handleRatings(req, supabaseClient, user, path) {
  const method = req.method;

  // POST /ratings - Submit rating for a profile
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const {
      rated_id,
      looks_score,
      personality_score,
      interests_score,
      lifestyle_score,
      category_weights,
    } = body;

    // Insert rating (overall_score calculated by trigger)
    const { data, error } = await supabaseClient
      .from('hugo_love.ratings')
      .insert({
        rater_id: user.id,
        rated_id,
        looks_score,
        personality_score,
        interests_score,
        lifestyle_score,
        category_weights,
      })
      .select()
      .single();

    if (error) throw error;

    // Check for mutual ratings ≥80 to create match
    await checkForMatch(supabaseClient, user.id, rated_id);

    return new Response(JSON.stringify({ rating: data }), {
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
// MATCHES
// ============================================================================

async function handleMatches(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /matches - Get user's matches
  if (method === 'GET' && path.length === 0) {
    const { data, error } = await supabaseClient
      .from('hugo_love.matches')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq('status', 'active')
      .order('matched_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ matches: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

async function handleConversations(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /conversations - Get user's conversations
  if (method === 'GET' && path.length === 0) {
    const { data, error } = await supabaseClient
      .from('hugo_love.conversations')
      .select(
        `
        *,
        match:matches(*)
      `
      )
      .or(`match.user_a_id.eq.${user.id},match.user_b_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ conversations: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// MESSAGES
// ============================================================================

async function handleMessages(req, supabaseClient, user, path) {
  const method = req.method;

  // GET /messages/:conversation_id - Get messages for conversation
  if (method === 'GET' && path.length === 1) {
    const conversationId = path[0];

    const { data, error } = await supabaseClient
      .from('hugo_love.messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    return new Response(JSON.stringify({ messages: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /messages - Send new message
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const { conversation_id, recipient_id, content } = body;

    const { data, error } = await supabaseClient
      .from('hugo_love.messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        recipient_id,
        content,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ message: data }), {
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
// VIDEO DATES
// ============================================================================

async function handleVideoDates(req, supabaseClient, user, path) {
  const method = req.method;

  // POST /video-dates - Schedule new video date
  if (method === 'POST' && path.length === 0) {
    const body = await req.json();
    const { match_id, type, scheduled_at } = body;

    // Get match to determine participants
    const { data: match, error: matchError } = await supabaseClient
      .from('hugo_love.matches')
      .select('*')
      .eq('id', match_id)
      .single();

    if (matchError) throw matchError;

    const [participant_a_id, participant_b_id] = [match.user_a_id, match.user_b_id].sort();

    const { data, error } = await supabaseClient
      .from('hugo_love.video_dates')
      .insert({
        match_id,
        participant_a_id,
        participant_b_id,
        type,
        scheduled_at,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ video_date: data }), {
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
// HELPER FUNCTIONS
// ============================================================================

async function checkForMatch(supabaseClient, userId, ratedUserId) {
  // Get both users' ratings
  const { data: userRating } = await supabaseClient
    .from('hugo_love.ratings')
    .select('overall_score')
    .eq('rater_id', userId)
    .eq('rated_id', ratedUserId)
    .single();

  const { data: partnerRating } = await supabaseClient
    .from('hugo_love.ratings')
    .select('overall_score')
    .eq('rater_id', ratedUserId)
    .eq('rated_id', userId)
    .single();

  // Check if both ratings exist and are ≥80
  if (
    userRating &&
    partnerRating &&
    userRating.overall_score >= 80 &&
    partnerRating.overall_score >= 80
  ) {
    // Create match (user_a_id < user_b_id)
    const [user_a_id, user_b_id] = [userId, ratedUserId].sort();

    await supabaseClient.from('hugo_love.matches').insert({
      user_a_id,
      user_b_id,
      user_a_rating: userRating.overall_score,
      user_b_rating: partnerRating.overall_score,
    });
  }
}
