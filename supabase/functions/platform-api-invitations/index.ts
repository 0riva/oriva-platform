/**
 * Platform API: App Invitations
 *
 * Allows marketplace apps to send email invitations with magic links.
 * Magic links redirect to the app launcher for centralized auth handling.
 *
 * Endpoints:
 * - POST /apps/{appId}/invitations - Create invitation
 * - GET /apps/{appId}/invitations - List invitations
 * - DELETE /apps/{appId}/invitations/{id} - Revoke invitation
 *
 * Authentication: X-API-Key header with developer API key (oriva_pk_live_*)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  role?: string;
  redirectPath?: string;
  metadata?: Record<string, unknown>;
}

interface ApiKeyValidation {
  valid: boolean;
  appId?: string;
  developerId?: string;
  error?: string;
}

/**
 * Hash API key using SHA-256 (matches key generation in client)
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API key and return associated app info
 */
async function validateApiKey(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  requestedAppId: string
): Promise<ApiKeyValidation> {
  // Validate key format
  if (!apiKey.startsWith('oriva_pk_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Hash the key
  const keyHash = await hashApiKey(apiKey);

  // Look up the key
  const { data: keyRecord, error: keyError } = await supabase
    .from('developer_api_keys')
    .select('id, user_id, app_id, is_active, permissions')
    .eq('key_hash', keyHash)
    .single();

  if (keyError || !keyRecord) {
    return { valid: false, error: 'Invalid API key' };
  }

  if (!keyRecord.is_active) {
    return { valid: false, error: 'API key is disabled' };
  }

  // Verify the key is associated with the requested app
  if (keyRecord.app_id !== requestedAppId) {
    return { valid: false, error: 'API key not authorized for this app' };
  }

  return {
    valid: true,
    appId: keyRecord.app_id,
    developerId: keyRecord.user_id,
  };
}

/**
 * Parse app ID from URL path
 * Expected format: /apps/{appId}/invitations or /apps/{appId}/invitations/{id}
 */
function parsePathParams(pathname: string): { appId?: string; invitationId?: string } {
  const match = pathname.match(/\/apps\/([^\/]+)\/invitations(?:\/([^\/]+))?/);
  if (!match) return {};
  return {
    appId: match[1],
    invitationId: match[2],
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const { appId, invitationId } = parsePathParams(url.pathname);

    if (!appId) {
      return new Response(JSON.stringify({ success: false, error: 'App ID required in path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'X-API-Key header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyValidation = await validateApiKey(supabase, apiKey, appId);
    if (!keyValidation.valid) {
      return new Response(JSON.stringify({ success: false, error: keyValidation.error }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify app exists and get app details
    const { data: app, error: appError } = await supabase
      .from('plugin_marketplace_apps')
      .select('id, name')
      .eq('id', appId)
      .single();

    if (appError || !app) {
      return new Response(JSON.stringify({ success: false, error: 'App not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route by method
    switch (req.method) {
      case 'POST':
        return await handleCreateInvitation(supabase, app, req);
      case 'GET':
        return await handleListInvitations(supabase, appId, url);
      case 'DELETE':
        if (!invitationId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invitation ID required for DELETE' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return await handleRevokeInvitation(supabase, appId, invitationId);
      default:
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Platform API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * POST /apps/{appId}/invitations
 * Create a new invitation and send magic link email
 */
async function handleCreateInvitation(
  supabase: ReturnType<typeof createClient>,
  app: { id: string; name: string },
  req: Request
): Promise<Response> {
  const body: InvitationRequest = await req.json();
  const { email, role, redirectPath, metadata } = body;

  if (!email) {
    return new Response(JSON.stringify({ success: false, error: 'Email is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid email format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create invitation record
  const { data: invitation, error: insertError } = await supabase
    .from('app_invitations')
    .insert({
      app_id: app.id,
      email: email.toLowerCase().trim(),
      role,
      redirect_path: redirectPath,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (insertError) {
    // Handle duplicate pending invitation
    if (insertError.code === '23505') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A pending invitation already exists for this email',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    throw insertError;
  }

  // Build redirect URL to app launcher
  const baseUrl = Deno.env.get('ORIVA_BASE_URL') || 'https://oriva.io';
  let redirectTo = `${baseUrl}/app-launcher/${app.id}?magic=true&invitation=${invitation.id}`;
  if (redirectPath) {
    redirectTo += `&redirect=${encodeURIComponent(redirectPath)}`;
  }

  // Generate magic link using Supabase Admin API
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email.toLowerCase().trim(),
    { redirectTo }
  );

  if (inviteError) {
    // Clean up invitation record on failure
    await supabase.from('app_invitations').delete().eq('id', invitation.id);

    console.error('Magic link generation failed:', inviteError);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to send invitation email',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update API key usage count
  // (handled by trigger or separate process)

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * GET /apps/{appId}/invitations
 * List invitations for the app
 */
async function handleListInvitations(
  supabase: ReturnType<typeof createClient>,
  appId: string,
  url: URL
): Promise<Response> {
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('app_invitations')
    .select('id, email, role, redirect_path, status, expires_at, accepted_at, created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: invitations, error } = await query;

  if (error) {
    throw error;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: invitations,
      pagination: {
        limit,
        offset,
        total: invitations?.length || 0,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * DELETE /apps/{appId}/invitations/{id}
 * Revoke a pending invitation
 */
async function handleRevokeInvitation(
  supabase: ReturnType<typeof createClient>,
  appId: string,
  invitationId: string
): Promise<Response> {
  // Update status to revoked (only if pending)
  const { data: invitation, error } = await supabase
    .from('app_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('app_id', appId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !invitation) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invitation not found or already processed',
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: { id: invitation.id, status: invitation.status },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
