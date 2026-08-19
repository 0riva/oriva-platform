/**
 * Oriva Bridge Public Routes
 * Mounted at /api/v1/bridge
 *
 * Headless surface for the Oriva Bridge (cross-tool task sync). Mirrors the
 * in-app bridge actions so the dev toolkit (SDK/CLI/MCP) can drive connections,
 * bridges, tasks, and sync without the UI.
 *
 * Data lives in the `oriva_bridge` Postgres schema (managed by o-core). This
 * router queries it via the service-role client with `.schema('oriva_bridge')`
 * and enforces org-membership scoping in-handler (service role bypasses RLS, so
 * the same rule the RLS policies encode is applied here explicitly).
 *
 * NOTE: requires the `oriva_bridge` schema to be exposed to PostgREST
 * (db-schemas / [api] schemas). That exposure is a separate deploy step.
 */

import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { ApiKeyInfo } from '../../types/middleware/auth';
import { respondWithError } from '../utils/response';

type AuthenticatedHandler = (req: any, res: any, keyInfo: ApiKeyInfo) => Promise<void> | void;
type WithAuthContext = (handler: AuthenticatedHandler) => RequestHandler;

const ACTIVE_PLATFORMS = ['monday', 'clickup', 'asana', 'notion'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OrgMembership {
  organization_id: string;
  role: string;
}

export function createBridgePublicRouter(
  supabase: SupabaseClient,
  logger: Logger,
  validateApiKey: RequestHandler,
  withAuthContext: WithAuthContext
): Router {
  const router = Router();

  // Schema-qualified accessor. o-platform's typed client doesn't model the
  // oriva_bridge schema, so we access it untyped here.
  const bridge = () => (supabase as unknown as { schema: (s: string) => any }).schema('oriva_bridge');

  async function callerOrgs(keyInfo: ApiKeyInfo): Promise<OrgMembership[]> {
    const { data } = await bridge()
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', keyInfo.userId)
      .is('deleted_at', null);
    return (data ?? []) as OrgMembership[];
  }

  // ---------------------------------------------------------------------------
  // GET /connections — connected tools across the caller's orgs
  // ---------------------------------------------------------------------------
  router.get(
    '/connections',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        const orgs = await callerOrgs(keyInfo);
        const orgIds = orgs.map((o) => o.organization_id);
        if (orgIds.length === 0) {
          res.json({ ok: true, success: true, data: [] });
          return;
        }

        const { data: tokens } = await bridge()
          .from('tokens')
          .select('platform, workspace_id, created_at')
          .in('organization_id', orgIds)
          .is('deleted_at', null);

        const data = ACTIVE_PLATFORMS.map((platform) => {
          const token = (tokens ?? []).find((t: any) => t.platform === platform);
          return {
            platform,
            connected: Boolean(token),
            workspaceId: token?.workspace_id ?? null,
            connectedAt: token?.created_at ?? null,
          };
        });

        res.json({ ok: true, success: true, data });
      } catch (error) {
        logger.error('Bridge connections list failed', { error });
        respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to list connections');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // POST /connections — headless connect with a raw API token
  // ---------------------------------------------------------------------------
  router.post(
    '/connections',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { platform, apiToken } = (req.body ?? {}) as { platform?: string; apiToken?: string };
        if (!platform || !ACTIVE_PLATFORMS.includes(platform as (typeof ACTIVE_PLATFORMS)[number])) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'platform must be one of monday, clickup, asana, notion');
          return;
        }
        if (!apiToken || typeof apiToken !== 'string') {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'apiToken is required');
          return;
        }

        const orgs = await callerOrgs(keyInfo);
        const adminOrg = orgs.find((o) => o.role === 'owner' || o.role === 'admin');
        if (!adminOrg) {
          respondWithError(res, 403, 'FORBIDDEN', 'Caller is not an admin of any organization');
          return;
        }

        // Store matching the in-app connect path (bridgeConnectionService):
        // the raw token lives in access_token_enc. Encryption-at-rest is a
        // separate cross-path follow-up (the UI path stores raw today too).
        const { error } = await bridge()
          .from('tokens')
          .upsert(
            {
              organization_id: adminOrg.organization_id,
              user_id: keyInfo.userId,
              token_type: 'sync',
              platform,
              access_token_enc: apiToken,
              refresh_token_enc: null,
              expires_at: null,
            },
            { onConflict: 'organization_id,user_id,platform' }
          );

        if (error) {
          logger.error('Bridge connection upsert failed', { error });
          respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to store connection');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: { platform, connected: true, workspaceId: null, connectedAt: new Date().toISOString() },
        });
      } catch (error) {
        logger.error('Bridge connection create failed', { error });
        respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // DELETE /connections/:platform
  // ---------------------------------------------------------------------------
  router.delete(
    '/connections/:platform',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const platform = req.params.platform;
        if (!ACTIVE_PLATFORMS.includes(platform)) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'Unsupported platform');
          return;
        }

        const orgs = await callerOrgs(keyInfo);
        const adminOrgIds = orgs
          .filter((o) => o.role === 'owner' || o.role === 'admin')
          .map((o) => o.organization_id);
        if (adminOrgIds.length === 0) {
          respondWithError(res, 403, 'FORBIDDEN', 'Caller is not an admin of any organization');
          return;
        }

        await bridge()
          .from('tokens')
          .update({ deleted_at: new Date().toISOString() })
          .in('organization_id', adminOrgIds)
          .eq('platform', platform)
          .is('deleted_at', null);

        res.json({ ok: true, success: true, data: { platform } });
      } catch (error) {
        logger.error('Bridge disconnect failed', { error });
        respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to disconnect');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // GET /groups — bridges the caller's orgs participate in
  // ---------------------------------------------------------------------------
  router.get(
    '/groups',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        const orgs = await callerOrgs(keyInfo);
        const orgIds = orgs.map((o) => o.organization_id);
        if (orgIds.length === 0) {
          res.json({ ok: true, success: true, data: [] });
          return;
        }

        const { data: memberships } = await bridge()
          .from('organization_group_memberships')
          .select('bridge_group_id, bridge_groups:bridge_group_id(id, name, description)')
          .in('organization_id', orgIds)
          .is('deleted_at', null)
          .eq('status', 'active');

        const data = await Promise.all(
          (memberships ?? []).map(async (m: any) => {
            const bg = m.bridge_groups;
            const { count } = await bridge()
              .from('organization_group_memberships')
              .select('id', { count: 'exact', head: true })
              .eq('bridge_group_id', bg.id)
              .is('deleted_at', null)
              .eq('status', 'active');
            return {
              id: bg.id,
              name: bg.name,
              description: bg.description ?? null,
              participantCount: count ?? 0,
              // Health is computed by o-core's status service; not surfaced here yet.
              health: null,
            };
          })
        );

        res.json({ ok: true, success: true, data });
      } catch (error) {
        logger.error('Bridge groups list failed', { error });
        respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to list bridges');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // GET /tasks?bridgeGroupId=<uuid>
  // ---------------------------------------------------------------------------
  router.get(
    '/tasks',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const bridgeGroupId = String(req.query.bridgeGroupId ?? '');
        if (!UUID_RE.test(bridgeGroupId)) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'bridgeGroupId (uuid) query param is required');
          return;
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);

        if (!(await participatesInBridge(keyInfo, bridgeGroupId))) {
          respondWithError(res, 403, 'FORBIDDEN', 'Caller does not participate in this bridge');
          return;
        }

        const { data: tasks } = await bridge()
          .from('tasks')
          .select('id, bridge_group_id, source_platform, source_id, title, status, priority, due_date')
          .eq('bridge_group_id', bridgeGroupId)
          .is('deleted_at', null)
          .limit(limit);

        const data = (tasks ?? []).map((t: any) => ({
          id: t.id,
          bridgeGroupId: t.bridge_group_id,
          sourcePlatform: t.source_platform,
          sourceId: t.source_id,
          title: t.title,
          status: t.status ?? null,
          priority: t.priority ?? null,
          dueDate: t.due_date ?? null,
        }));

        res.json({ ok: true, success: true, data });
      } catch (error) {
        logger.error('Bridge tasks list failed', { error });
        respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to list tasks');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // POST /sync — enqueue a manual reconcile for a bridge
  // ---------------------------------------------------------------------------
  router.post(
    '/sync',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { bridgeGroupId } = (req.body ?? {}) as { bridgeGroupId?: string };
        if (!bridgeGroupId || !UUID_RE.test(bridgeGroupId)) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'bridgeGroupId (uuid) is required');
          return;
        }

        const orgs = await callerOrgs(keyInfo);
        const membership = await bridge()
          .from('organization_group_memberships')
          .select('organization_id')
          .eq('bridge_group_id', bridgeGroupId)
          .in('organization_id', orgs.map((o) => o.organization_id))
          .is('deleted_at', null)
          .limit(1);

        const orgId = membership?.data?.[0]?.organization_id;
        if (!orgId) {
          respondWithError(res, 403, 'FORBIDDEN', 'Caller does not participate in this bridge');
          return;
        }

        const { error } = await bridge()
          .from('sync_events')
          .insert({
            bridge_group_id: bridgeGroupId,
            organization_id: orgId,
            platform: 'manual',
            event_type: 'manual_reconcile',
            payload: { source: 'api', triggered_by: keyInfo.userId },
            status: 'pending',
          });

        if (error) {
          logger.error('Bridge sync enqueue failed', { error });
          respondWithError(res, 500, 'BRIDGE_ERROR', 'Failed to enqueue sync');
          return;
        }

        res.status(202).json({ ok: true, success: true, data: { bridgeGroupId, enqueued: true } });
      } catch (error) {
        logger.error('Bridge sync failed', { error });
        respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
    })
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  async function participatesInBridge(keyInfo: ApiKeyInfo, bridgeGroupId: string): Promise<boolean> {
    const orgs = await callerOrgs(keyInfo);
    const orgIds = orgs.map((o) => o.organization_id);
    if (orgIds.length === 0) return false;
    const { data } = await bridge()
      .from('organization_group_memberships')
      .select('id')
      .eq('bridge_group_id', bridgeGroupId)
      .in('organization_id', orgIds)
      .is('deleted_at', null)
      .limit(1);
    return Boolean(data && data.length > 0);
  }

  return router;
}
