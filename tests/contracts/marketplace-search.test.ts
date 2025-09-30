/**
 * Marketplace Search API Contract Tests
 * 
 * Tests for POST /api/v1/marketplace/search endpoint
 * Following TDD approach - tests written before implementation
 */

import request from 'supertest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Marketplace Search API', () => {
  let testAccessToken: string;
  let testUserId: string;
  let testItemIds: string[] = [];

  beforeAll(async () => {
    // Register test user
    const registerRes = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: `marketplace-search-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `searchtest${Date.now()}`,
      })
      .expect(201);

    testUserId = registerRes.body.user.id;

    // Login to get access token
    const loginRes = await request(API_BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: registerRes.body.user.email,
        password: 'TestPassword123!',
      })
      .expect(200);

    testAccessToken = loginRes.body.access_token;

    // Create test marketplace items for search
    const testItems = [
      {
        title: 'Premium React Component Library',
        description: 'A comprehensive collection of React components for building modern web applications. Includes UI components, hooks, and utilities.',
        price: 49.99,
        currency: 'USD',
        item_type: 'digital_product',
        category_id: 'ui-components',
        status: 'active',
        metadata: { tags: ['react', 'components', 'ui', 'frontend'] },
      },
      {
        title: 'Vue.js Dashboard Template',
        description: 'Professional admin dashboard template built with Vue.js and Tailwind CSS. Perfect for SaaS applications.',
        price: 79.99,
        currency: 'USD',
        item_type: 'digital_product',
        category_id: 'templates',
        status: 'active',
        metadata: { tags: ['vue', 'dashboard', 'admin', 'template'] },
      },
      {
        title: 'Node.js API Development Service',
        description: 'Custom API development services using Node.js, Express, and PostgreSQL. Scalable and secure backend solutions.',
        price: 500.00,
        currency: 'USD',
        item_type: 'service',
        category_id: 'development-services',
        status: 'active',
        metadata: { tags: ['nodejs', 'api', 'backend', 'postgresql'] },
      },
      {
        title: 'Mobile App UI Kit',
        description: 'Complete mobile app design system with 100+ screens and components. Available for Figma and Sketch.',
        price: 39.99,
        currency: 'USD',
        item_type: 'digital_product',
        category_id: 'design-assets',
        status: 'active',
        metadata: { tags: ['mobile', 'ui-kit', 'design', 'figma'] },
      },
      {
        title: 'Draft Product - Not Searchable',
        description: 'This item should not appear in search results.',
        price: 99.99,
        currency: 'USD',
        item_type: 'digital_product',
        category_id: 'misc',
        status: 'draft',
        metadata: { tags: ['draft'] },
      },
    ];

    for (const item of testItems) {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send(item)
        .expect(201);
      
      testItemIds.push(response.body.id);
    }

    // Wait a moment for search indexing (if applicable)
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test items
    for (const itemId of testItemIds) {
      await request(API_BASE_URL)
        .delete(`/api/v1/marketplace/items/${itemId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .catch(() => {}); // Ignore errors during cleanup
    }
  });

  describe('POST /api/v1/marketplace/search', () => {
    describe('Basic Text Search', () => {
      it('should search items by query string in title', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'React Component',
          })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items.length).toBeGreaterThan(0);
        
        // Should find the React Component Library
        const reactItem = response.body.items.find(
          (item: any) => item.title.includes('React Component')
        );
        expect(reactItem).toBeDefined();
        expect(reactItem.title).toContain('React');
      });

      it('should search items by query string in description', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'Tailwind CSS',
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        const vueItem = response.body.items.find(
          (item: any) => item.description.includes('Tailwind CSS')
        );
        expect(vueItem).toBeDefined();
      });

      it('should return empty results for non-matching query', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'NonExistentProductXYZ12345',
          })
          .expect(200);

        expect(response.body.items).toEqual([]);
        expect(response.body.total).toBe(0);
      });

      it('should handle empty query string gracefully', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
          })
          .expect(200);

        // Empty query should return all active items or handle gracefully
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      });
    });

    describe('Filters', () => {
      it('should filter search results by item_type', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'API',
            filters: {
              item_type: 'service',
            },
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        response.body.items.forEach((item: any) => {
          expect(item.item_type).toBe('service');
        });
      });

      it('should filter search results by price range', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            filters: {
              min_price: 40,
              max_price: 80,
            },
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        response.body.items.forEach((item: any) => {
          expect(item.price).toBeGreaterThanOrEqual(40);
          expect(item.price).toBeLessThanOrEqual(80);
        });
      });

      it('should filter search results by category_id', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            filters: {
              category_id: 'ui-components',
            },
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        response.body.items.forEach((item: any) => {
          expect(item.category_id).toBe('ui-components');
        });
      });

      it('should filter search results by seller_id', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            filters: {
              seller_id: testUserId,
            },
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        response.body.items.forEach((item: any) => {
          expect(item.seller_id).toBe(testUserId);
        });
      });

      it('should combine multiple filters', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'component',
            filters: {
              item_type: 'digital_product',
              min_price: 30,
              max_price: 50,
            },
          })
          .expect(200);

        response.body.items.forEach((item: any) => {
          expect(item.item_type).toBe('digital_product');
          expect(item.price).toBeGreaterThanOrEqual(30);
          expect(item.price).toBeLessThanOrEqual(50);
        });
      });
    });

    describe('Sorting', () => {
      it('should sort results by price ascending', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            sort: 'price',
            order: 'asc',
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(1);
        
        // Verify ascending order
        for (let i = 1; i < response.body.items.length; i++) {
          expect(response.body.items[i].price).toBeGreaterThanOrEqual(
            response.body.items[i - 1].price
          );
        }
      });

      it('should sort results by price descending', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            sort: 'price',
            order: 'desc',
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(1);
        
        // Verify descending order
        for (let i = 1; i < response.body.items.length; i++) {
          expect(response.body.items[i].price).toBeLessThanOrEqual(
            response.body.items[i - 1].price
          );
        }
      });

      it('should sort results by created_at (newest first)', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            sort: 'created_at',
            order: 'desc',
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(1);
        
        // Verify newest first
        for (let i = 1; i < response.body.items.length; i++) {
          const current = new Date(response.body.items[i].created_at).getTime();
          const previous = new Date(response.body.items[i - 1].created_at).getTime();
          expect(current).toBeLessThanOrEqual(previous);
        }
      });

      it('should default to relevance sorting when no sort specified', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'React',
          })
          .expect(200);

        expect(response.body.items.length).toBeGreaterThan(0);
        // Default relevance sorting should prioritize exact matches in title
        const firstItem = response.body.items[0];
        expect(firstItem.title.toLowerCase()).toContain('react');
      });
    });

    describe('Pagination', () => {
      it('should paginate search results', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            page: 1,
            limit: 2,
          })
          .expect(200);

        expect(response.body.items.length).toBeLessThanOrEqual(2);
        expect(response.body).toHaveProperty('page', 1);
        expect(response.body).toHaveProperty('limit', 2);
        expect(response.body).toHaveProperty('total');
      });

      it('should return correct page of results', async () => {
        const page1 = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            page: 1,
            limit: 2,
          })
          .expect(200);

        const page2 = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            page: 2,
            limit: 2,
          })
          .expect(200);

        // Items on page 2 should be different from page 1
        const page1Ids = page1.body.items.map((item: any) => item.id);
        const page2Ids = page2.body.items.map((item: any) => item.id);
        
        const overlap = page1Ids.some((id: string) => page2Ids.includes(id));
        expect(overlap).toBe(false);
      });

      it('should enforce maximum limit of 100', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            limit: 200,
          })
          .expect(200);

        // Should cap at 100
        expect(response.body.limit).toBeLessThanOrEqual(100);
      });
    });

    describe('Status Filtering', () => {
      it('should only return active items by default', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
          })
          .expect(200);

        response.body.items.forEach((item: any) => {
          expect(item.status).toBe('active');
        });
      });

      it('should not return draft items in search results', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'Draft Product',
          })
          .expect(200);

        // Should not find the draft item
        expect(response.body.items.length).toBe(0);
      });
    });

    describe('Semantic Search (if available)', () => {
      it('should find semantically related items', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'user interface design tools',
            semantic: true,
          })
          .expect(200);

        // Should find UI-related items even without exact keyword match
        expect(response.body.items.length).toBeGreaterThan(0);
        
        const hasUIRelated = response.body.items.some((item: any) => 
          item.title.toLowerCase().includes('ui') ||
          item.description.toLowerCase().includes('ui') ||
          item.title.toLowerCase().includes('component') ||
          item.title.toLowerCase().includes('design')
        );
        expect(hasUIRelated).toBe(true);
      });

      it('should fallback to text search if semantic search fails', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: 'React',
            semantic: true,
          })
          .expect(200);

        // Should still return results even if semantic search isn't available
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should require authentication', async () => {
        await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .send({
            query: 'test',
          })
          .expect(401);
      });

      it('should validate invalid sort field', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            sort: 'invalid_field',
          })
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should validate invalid order value', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            order: 'invalid',
          })
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should handle invalid price range', async () => {
        const response = await request(API_BASE_URL)
          .post('/api/v1/marketplace/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .send({
            query: '',
            filters: {
              min_price: 100,
              max_price: 50, // max less than min
            },
          })
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits on search endpoint', async () => {
        const requests = [];
        
        // Make 30 requests rapidly (assuming rate limit is lower)
        for (let i = 0; i < 30; i++) {
          requests.push(
            request(API_BASE_URL)
              .post('/api/v1/marketplace/search')
              .set('Authorization', `Bearer ${testAccessToken}`)
              .send({ query: 'test' })
          );
        }

        const responses = await Promise.all(requests);
        
        // At least some requests should be rate limited
        const rateLimited = responses.some(res => res.status === 429);
        expect(rateLimited).toBe(true);
      });
    });
  });
});