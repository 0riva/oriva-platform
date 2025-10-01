// Consolidated Marketplace API Handler
// Handles: GET /api/v1/marketplace/categories
//          GET /api/v1/marketplace/items
//          GET /api/v1/marketplace/items/:id
//          POST /api/v1/marketplace/items/create
//          GET /api/v1/marketplace/search
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCategories } from './marketplace/categories/index';
import { handleCreateItem } from './marketplace/items/create';
import { handleItemById } from './marketplace/items/[id]';
import { handleListItems } from './marketplace/items/index';
import { handleSearch } from './marketplace/search/index';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { url, method } = req;

  // GET /api/v1/marketplace/categories
  if (url?.includes('/categories') && method === 'GET') {
    await handleCategories(req, res);
    return;
  }

  // POST /api/v1/marketplace/items/create
  if (url?.includes('/items/create') && method === 'POST') {
    await handleCreateItem(req, res);
    return;
  }

  // GET /api/v1/marketplace/items/:id (must come before /items to avoid matching /items first)
  if (url?.match(/\/items\/[^/]+$/) && method === 'GET') {
    await handleItemById(req, res);
    return;
  }

  // GET /api/v1/marketplace/items
  if (url?.includes('/items') && method === 'GET') {
    await handleListItems(req, res);
    return;
  }

  // GET /api/v1/marketplace/search
  if (url?.includes('/search') && method === 'GET') {
    await handleSearch(req, res);
    return;
  }

  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
}
