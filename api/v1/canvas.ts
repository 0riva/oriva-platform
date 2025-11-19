// Consolidated Canvas API Handler
// Handles: GET    /api/v1/canvas/canvases
//          POST   /api/v1/canvas/canvases
//          GET    /api/v1/canvas/canvases/:id
//          PUT    /api/v1/canvas/canvases/:id
//          DELETE /api/v1/canvas/canvases/:id
//          PUT    /api/v1/canvas/canvases/:id/archive
//          PUT    /api/v1/canvas/canvases/:id/viewport
//          GET    /api/v1/canvas/canvases/:canvasId/items
//          POST   /api/v1/canvas/canvases/:canvasId/items
//          PUT    /api/v1/canvas/items/:itemId
//          PUT    /api/v1/canvas/items/:itemId/position
//          DELETE /api/v1/canvas/items/:itemId
//          POST   /api/v1/canvas/items/batch-update-positions
//          GET    /api/v1/canvas/canvases/:canvasId/connections
//          POST   /api/v1/canvas/connections
//          PUT    /api/v1/canvas/connections/:connectionId
//          DELETE /api/v1/canvas/connections/:connectionId
// Pattern: Catch-all routing for canvas operations

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../src/config/supabase';
import { asyncHandler, validationError, notFoundError } from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import logger from '../../src/utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Canvas {
  id: string;
  account_id: string;
  title: string;
  description?: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  content_bounds_min_x?: number;
  content_bounds_min_y?: number;
  content_bounds_max_x?: number;
  content_bounds_max_y?: number;
  is_archived: boolean;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
}

interface CanvasItem {
  id: string;
  canvas_id: string;
  account_id: string;
  entry_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  color: string;
  created_at: string;
  updated_at: string;
}

interface CanvasConnection {
  id: string;
  canvas_id: string;
  account_id: string;
  source_item_id: string;
  target_item_id: string;
  connection_type: string;
  color: string;
  label?: string;
  control_points: Array<{ x: number; y: number }>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CANVAS CRUD OPERATIONS
// ============================================================================

async function handleListCanvases(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  logger.info('Listing canvases', { userId });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .select('*')
    .eq('account_id', userId)
    .eq('is_archived', false)
    .order('last_accessed_at', { ascending: false });

  if (error) {
    logger.error('Error listing canvases', { userId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch canvases',
      code: 'CANVAS_LIST_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: data || [],
  });
}

async function handleCreateCanvas(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  const { userId } = req.authContext;
  const { title, description } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw validationError('Canvas title is required');
  }

  const supabase = getSupabaseClient();

  logger.info('Creating canvas', { userId, title });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .insert({
      account_id: userId,
      title: title.trim(),
      description: description?.trim() || null,
      viewport_x: 0,
      viewport_y: 0,
      viewport_zoom: 1,
      is_archived: false,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating canvas', { userId, title }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to create canvas',
      code: 'CANVAS_CREATE_ERROR',
    });
    return;
  }

  res.status(201).json({
    success: true,
    data,
  });
}

async function handleGetCanvas(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  logger.info('Getting canvas', { userId, canvasId });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .select('*')
    .eq('id', canvasId)
    .eq('account_id', userId)
    .single();

  if (error || !data) {
    throw notFoundError('Canvas not found');
  }

  // Update last_accessed_at
  await supabase
    .from('whiteboard_canvas.canvases' as any)
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', canvasId)
    .eq('account_id', userId);

  res.status(200).json({
    success: true,
    data,
  });
}

async function handleUpdateCanvas(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { title, description, content_bounds } = req.body;

  const supabase = getSupabaseClient();

  const updates: Partial<Canvas> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (content_bounds) {
    updates.content_bounds_min_x = content_bounds.minX;
    updates.content_bounds_min_y = content_bounds.minY;
    updates.content_bounds_max_x = content_bounds.maxX;
    updates.content_bounds_max_y = content_bounds.maxY;
  }

  logger.info('Updating canvas', { userId, canvasId, updates });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .update(updates)
    .eq('id', canvasId)
    .eq('account_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw notFoundError('Canvas not found');
  }

  res.status(200).json({
    success: true,
    data,
  });
}

async function handleDeleteCanvas(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  logger.info('Deleting canvas', { userId, canvasId });

  const { error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .delete()
    .eq('id', canvasId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error deleting canvas', { userId, canvasId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete canvas',
      code: 'CANVAS_DELETE_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Canvas deleted successfully',
  });
}

async function handleArchiveCanvas(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { archived } = req.body;

  if (typeof archived !== 'boolean') {
    throw validationError('Archived status must be boolean');
  }

  const supabase = getSupabaseClient();

  logger.info('Archiving canvas', { userId, canvasId, archived });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .update({ is_archived: archived })
    .eq('id', canvasId)
    .eq('account_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw notFoundError('Canvas not found');
  }

  res.status(200).json({
    success: true,
    data,
  });
}

async function handleUpdateViewport(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { x, y, zoom } = req.body;

  if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') {
    throw validationError('Viewport x, y, and zoom must be numbers');
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('whiteboard_canvas.canvases' as any)
    .update({
      viewport_x: x,
      viewport_y: y,
      viewport_zoom: zoom,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('id', canvasId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error updating viewport', { userId, canvasId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update viewport',
      code: 'VIEWPORT_UPDATE_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Viewport updated successfully',
  });
}

// ============================================================================
// CANVAS ITEMS OPERATIONS
// ============================================================================

async function handleListCanvasItems(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  logger.info('Listing canvas items', { userId, canvasId });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('account_id', userId)
    .order('z_index', { ascending: true });

  if (error) {
    logger.error('Error listing canvas items', { userId, canvasId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch canvas items',
      code: 'CANVAS_ITEMS_LIST_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: data || [],
  });
}

async function handleAddCanvasItem(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { entryId, position } = req.body;

  if (!entryId || !position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    throw validationError('Entry ID and position {x, y} are required');
  }

  const supabase = getSupabaseClient();

  logger.info('Adding canvas item', { userId, canvasId, entryId });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .insert({
      canvas_id: canvasId,
      account_id: userId,
      entry_id: entryId,
      position_x: position.x,
      position_y: position.y,
      width: 200,
      height: 150,
      z_index: 0,
      color: 'default',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error adding canvas item', { userId, canvasId, entryId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to canvas',
      code: 'CANVAS_ITEM_ADD_ERROR',
    });
    return;
  }

  res.status(201).json({
    success: true,
    data,
  });
}

async function handleUpdateCanvasItem(
  req: AuthenticatedRequest,
  res: VercelResponse,
  itemId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { width, height, z_index, color } = req.body;

  const supabase = getSupabaseClient();

  const updates: Partial<CanvasItem> = {};
  if (width !== undefined) updates.width = width;
  if (height !== undefined) updates.height = height;
  if (z_index !== undefined) updates.z_index = z_index;
  if (color !== undefined) updates.color = color;

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .update(updates)
    .eq('id', itemId)
    .eq('account_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw notFoundError('Canvas item not found');
  }

  res.status(200).json({
    success: true,
    data,
  });
}

async function handleUpdateItemPosition(
  req: AuthenticatedRequest,
  res: VercelResponse,
  itemId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { x, y } = req.body;

  if (typeof x !== 'number' || typeof y !== 'number') {
    throw validationError('Position x and y must be numbers');
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .update({
      position_x: x,
      position_y: y,
    })
    .eq('id', itemId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error updating item position', { userId, itemId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update item position',
      code: 'ITEM_POSITION_UPDATE_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Item position updated successfully',
  });
}

async function handleDeleteCanvasItem(
  req: AuthenticatedRequest,
  res: VercelResponse,
  itemId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .delete()
    .eq('id', itemId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error deleting canvas item', { userId, itemId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete item',
      code: 'CANVAS_ITEM_DELETE_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Item deleted successfully',
  });
}

async function handleBatchUpdatePositions(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { userId } = req.authContext;
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    throw validationError('Updates array is required');
  }

  const supabase = getSupabaseClient();

  logger.info('Batch updating positions', { userId, count: updates.length });

  // Execute all updates in parallel
  const promises = updates.map((update) =>
    supabase
      .from('whiteboard_canvas.canvas_items' as any)
      .update({
        position_x: update.x,
        position_y: update.y,
      })
      .eq('id', update.itemId)
      .eq('account_id', userId)
  );

  await Promise.all(promises);

  res.status(200).json({
    success: true,
    message: 'Positions updated successfully',
  });
}

// ============================================================================
// CANVAS CONNECTIONS OPERATIONS
// ============================================================================

async function handleListConnections(
  req: AuthenticatedRequest,
  res: VercelResponse,
  canvasId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  logger.info('Listing connections', { userId, canvasId });

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvas_connections' as any)
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error listing connections', { userId, canvasId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connections',
      code: 'CONNECTIONS_LIST_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: data || [],
  });
}

async function handleCreateConnection(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { userId } = req.authContext;
  const { canvasId, sourceItemId, targetItemId, connectionType, color, label } = req.body;

  if (!canvasId || !sourceItemId || !targetItemId) {
    throw validationError('Canvas ID, source item ID, and target item ID are required');
  }

  if (sourceItemId === targetItemId) {
    throw validationError('Cannot create self-referencing connection');
  }

  const supabase = getSupabaseClient();

  logger.info('Creating connection', { userId, canvasId, sourceItemId, targetItemId });

  // 1. Create canvas connection
  const { data: connection, error: connectionError } = await supabase
    .from('whiteboard_canvas.canvas_connections' as any)
    .insert({
      canvas_id: canvasId,
      account_id: userId,
      source_item_id: sourceItemId,
      target_item_id: targetItemId,
      connection_type: connectionType || 'arrow',
      color: color || 'default',
      label: label || null,
    })
    .select()
    .single();

  if (connectionError) {
    logger.error('Error creating connection', { userId, canvasId }, connectionError);
    res.status(500).json({
      success: false,
      error: 'Failed to create connection',
      code: 'CONNECTION_CREATE_ERROR',
    });
    return;
  }

  // 2. Get entry IDs from canvas items
  const { data: sourceItem } = (await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .select('entry_id')
    .eq('id', sourceItemId)
    .single()) as { data: { entry_id: string } | null };

  const { data: targetItem } = (await supabase
    .from('whiteboard_canvas.canvas_items' as any)
    .select('entry_id')
    .eq('id', targetItemId)
    .single()) as { data: { entry_id: string } | null };

  // 3. Create entry relation (sync to public.entry_relations)
  if (sourceItem && targetItem) {
    await supabase.from('public.entry_relations' as any).insert({
      source_entry_id: sourceItem.entry_id,
      target_entry_id: targetItem.entry_id,
      created_by_user_id: userId,
      relation_type: 'related-to',
      active: true,
    });

    logger.info('Entry relation created', {
      sourceEntryId: sourceItem.entry_id,
      targetEntryId: targetItem.entry_id,
    });
  }

  res.status(201).json({
    success: true,
    data: connection,
  });
}

async function handleUpdateConnection(
  req: AuthenticatedRequest,
  res: VercelResponse,
  connectionId: string
): Promise<void> {
  const { userId } = req.authContext;
  const { connectionType, color, label, controlPoints } = req.body;

  const supabase = getSupabaseClient();

  const updates: Partial<CanvasConnection> = {};
  if (connectionType !== undefined) updates.connection_type = connectionType;
  if (color !== undefined) updates.color = color;
  if (label !== undefined) updates.label = label;
  if (controlPoints !== undefined) updates.control_points = controlPoints;

  const { data, error } = await supabase
    .from('whiteboard_canvas.canvas_connections' as any)
    .update(updates)
    .eq('id', connectionId)
    .eq('account_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw notFoundError('Connection not found');
  }

  res.status(200).json({
    success: true,
    data,
  });
}

async function handleDeleteConnection(
  req: AuthenticatedRequest,
  res: VercelResponse,
  connectionId: string
): Promise<void> {
  const { userId } = req.authContext;
  const supabase = getSupabaseClient();

  // Get connection details before deleting
  const { data: connection } = (await supabase
    .from('whiteboard_canvas.canvas_connections' as any)
    .select('source_item_id, target_item_id')
    .eq('id', connectionId)
    .eq('account_id', userId)
    .single()) as { data: { source_item_id: string; target_item_id: string } | null };

  if (connection) {
    // Get entry IDs
    const { data: sourceItem } = (await supabase
      .from('whiteboard_canvas.canvas_items' as any)
      .select('entry_id')
      .eq('id', connection.source_item_id)
      .single()) as { data: { entry_id: string } | null };

    const { data: targetItem } = (await supabase
      .from('whiteboard_canvas.canvas_items' as any)
      .select('entry_id')
      .eq('id', connection.target_item_id)
      .single()) as { data: { entry_id: string } | null };

    // Soft delete entry relation
    if (sourceItem && targetItem) {
      await supabase
        .from('public.entry_relations' as any)
        .update({ active: false })
        .eq('source_entry_id', sourceItem.entry_id)
        .eq('target_entry_id', targetItem.entry_id)
        .eq('created_by_user_id', userId);
    }
  }

  // Delete canvas connection
  const { error } = await supabase
    .from('whiteboard_canvas.canvas_connections' as any)
    .delete()
    .eq('id', connectionId)
    .eq('account_id', userId);

  if (error) {
    logger.error('Error deleting connection', { userId, connectionId }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete connection',
      code: 'CONNECTION_DELETE_ERROR',
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Connection deleted successfully',
  });
}

// ============================================================================
// MAIN HANDLER (Route Dispatcher)
// ============================================================================

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Apply rate limiting
  await rateLimit(req, res, async () => {
    // Apply authentication
    await authenticate(req, res, async () => {
      const authReq = req as AuthenticatedRequest;
      const { method } = req;
      const path = req.url?.split('?')[0] || '';

      logger.info('Canvas API request', { method, path });

      try {
        // Parse route segments
        const segments = path.split('/').filter((s) => s);

        // Route: /api/v1/canvas/canvases
        if (segments[3] === 'canvases' && !segments[4]) {
          if (method === 'GET') return await handleListCanvases(authReq, res);
          if (method === 'POST') return await handleCreateCanvas(authReq, res);
        }

        // Route: /api/v1/canvas/canvases/:id
        if (segments[3] === 'canvases' && segments[4] && !segments[5]) {
          const canvasId = segments[4];
          if (method === 'GET') return await handleGetCanvas(authReq, res, canvasId);
          if (method === 'PUT') return await handleUpdateCanvas(authReq, res, canvasId);
          if (method === 'DELETE') return await handleDeleteCanvas(authReq, res, canvasId);
        }

        // Route: /api/v1/canvas/canvases/:id/archive
        if (segments[3] === 'canvases' && segments[5] === 'archive') {
          const canvasId = segments[4];
          if (method === 'PUT') return await handleArchiveCanvas(authReq, res, canvasId);
        }

        // Route: /api/v1/canvas/canvases/:id/viewport
        if (segments[3] === 'canvases' && segments[5] === 'viewport') {
          const canvasId = segments[4];
          if (method === 'PUT') return await handleUpdateViewport(authReq, res, canvasId);
        }

        // Route: /api/v1/canvas/canvases/:canvasId/items
        if (segments[3] === 'canvases' && segments[5] === 'items') {
          const canvasId = segments[4];
          if (method === 'GET') return await handleListCanvasItems(authReq, res, canvasId);
          if (method === 'POST') return await handleAddCanvasItem(authReq, res, canvasId);
        }

        // Route: /api/v1/canvas/items/:itemId
        if (segments[3] === 'items' && segments[4] && !segments[5]) {
          const itemId = segments[4];
          if (method === 'PUT') return await handleUpdateCanvasItem(authReq, res, itemId);
          if (method === 'DELETE') return await handleDeleteCanvasItem(authReq, res, itemId);
        }

        // Route: /api/v1/canvas/items/:itemId/position
        if (segments[3] === 'items' && segments[5] === 'position') {
          const itemId = segments[4];
          if (method === 'PUT') return await handleUpdateItemPosition(authReq, res, itemId);
        }

        // Route: /api/v1/canvas/items/batch-update-positions
        if (segments[3] === 'items' && segments[4] === 'batch-update-positions') {
          if (method === 'POST') return await handleBatchUpdatePositions(authReq, res);
        }

        // Route: /api/v1/canvas/canvases/:canvasId/connections
        if (segments[3] === 'canvases' && segments[5] === 'connections') {
          const canvasId = segments[4];
          if (method === 'GET') return await handleListConnections(authReq, res, canvasId);
        }

        // Route: /api/v1/canvas/connections
        if (segments[3] === 'connections' && !segments[4]) {
          if (method === 'POST') return await handleCreateConnection(authReq, res);
        }

        // Route: /api/v1/canvas/connections/:connectionId
        if (segments[3] === 'connections' && segments[4] && !segments[5]) {
          const connectionId = segments[4];
          if (method === 'PUT') return await handleUpdateConnection(authReq, res, connectionId);
          if (method === 'DELETE') return await handleDeleteConnection(authReq, res, connectionId);
        }

        // No route matched
        res.status(404).json({
          success: false,
          error: 'Not found',
          code: 'ROUTE_NOT_FOUND',
        });
      } catch (error) {
        logger.error('Canvas API error', { method, path }, error as Error);

        if ((error as any).statusCode) {
          res.status((error as any).statusCode).json({
            success: false,
            error: (error as Error).message,
            code: (error as any).code || 'UNKNOWN_ERROR',
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
          });
        }
      }
    });
  });
}

export default asyncHandler(handler);
