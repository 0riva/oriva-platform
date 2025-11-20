// @ts-nocheck - TODO: Fix type errors
// Consolidated Marketplace API Handler
// Handles: GET /api/v1/marketplace/categories
//          GET /api/v1/marketplace/items (also aliased as /apps for backward compatibility)
//          GET /api/v1/marketplace/items/:id
//          POST /api/v1/marketplace/items/create
//          GET /api/v1/marketplace/search
//          GET /api/v1/marketplace/installed
//          POST /api/v1/marketplace/install/:appId
//          DELETE /api/v1/marketplace/uninstall/:appId
//          GET /api/v1/marketplace/apps (alias for /items)
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCategories } from '../../src/handlers/marketplace/categories/index';
import { handleCreateItem } from '../../src/handlers/marketplace/items/create';
import { handleItemById } from '../../src/handlers/marketplace/items/[id]';
import { handleListItems } from '../../src/handlers/marketplace/items/list';
import { handleSearch } from '../../src/handlers/marketplace/search/index';
import { handleInstalledApps } from '../../src/handlers/marketplace/installed/index';
import { handleInstallApp } from '../../src/handlers/marketplace/install/index';
import { handleUninstallApp } from '../../src/handlers/marketplace/uninstall/index';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { url, method } = req;

  // Handle OPTIONS for CORS preflight
  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract pathname without query parameters
  const pathname = url?.split('?')[0] || '';

  // GET /api/v1/marketplace/categories
  if (pathname.match(/\/categories$/) && method === 'GET') {
    await handleCategories(req, res);
    return;
  }

  // POST /api/v1/marketplace/items/create
  if (pathname.match(/\/items\/create$/) && method === 'POST') {
    await handleCreateItem(req, res);
    return;
  }

  // GET /api/v1/marketplace/items/:id (must come before /items to avoid matching /items first)
  if (pathname.match(/\/items\/[^/]+$/) && method === 'GET') {
    await handleItemById(req, res);
    return;
  }

  // GET /api/v1/marketplace/items
  if (pathname.match(/\/items$/) && method === 'GET') {
    await handleListItems(req, res);
    return;
  }

  // GET /api/v1/marketplace/search
  if (pathname.match(/\/search$/) && method === 'GET') {
    await handleSearch(req, res);
    return;
  }

  // GET /api/v1/marketplace/installed
  if (pathname.match(/\/installed$/) && method === 'GET') {
    await handleInstalledApps(req, res);
    return;
  }

  // POST /api/v1/marketplace/install/:appId
  if (pathname.match(/\/install\/[^/]+$/) && method === 'POST') {
    await handleInstallApp(req, res);
    return;
  }

  // DELETE /api/v1/marketplace/uninstall/:appId
  if (pathname.match(/\/uninstall\/[^/]+$/) && method === 'DELETE') {
    await handleUninstallApp(req, res);
    return;
  }

  // GET /api/v1/marketplace/apps (alias for /items for backward compatibility)
  if (pathname.match(/\/apps$/) && method === 'GET') {
    await handleListItems(req, res);
    return;
  }

  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
}
