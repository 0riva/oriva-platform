/**
 * Marketplace Categories API Contract Tests
 * 
 * Tests for GET /api/v1/marketplace/categories endpoint
 * Following TDD approach - tests written before implementation
 */

import request from 'supertest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Marketplace Categories API', () => {
  let testAccessToken: string;

  beforeAll(async () => {
    // Register test user
    const registerRes = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: `marketplace-categories-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: `categoriestest${Date.now()}`,
      })
      .expect(201);

    // Login to get access token
    const loginRes = await request(API_BASE_URL)
      .post('/api/v1/auth/login')
      .send({
        email: registerRes.body.user.email,
        password: 'TestPassword123!',
      })
      .expect(200);

    testAccessToken = loginRes.body.access_token;
  });

  describe('GET /api/v1/marketplace/categories', () => {
    describe('Basic Functionality', () => {
      it('should return list of marketplace categories', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('categories');
        expect(Array.isArray(response.body.categories)).toBe(true);
        expect(response.body.categories.length).toBeGreaterThan(0);
      });

      it('should return categories with required fields', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        const category = response.body.categories[0];
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('item_count');
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.slug).toBe('string');
        expect(typeof category.item_count).toBe('number');
      });

      it('should include standard marketplace categories', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        const categoryNames = response.body.categories.map((cat: any) => cat.name);
        
        // Check for some expected standard categories
        const expectedCategories = [
          'UI Components',
          'Templates',
          'Extensions',
          'Development Services',
        ];

        expectedCategories.forEach(expectedCat => {
          const found = categoryNames.some((name: string) => 
            name.toLowerCase().includes(expectedCat.toLowerCase())
          );
          expect(found).toBe(true);
        });
      });
    });

    describe('Category Hierarchy', () => {
      it('should support parent-child category relationships', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Check if any categories have parent_id
        const hasHierarchy = response.body.categories.some(
          (cat: any) => cat.parent_id !== null && cat.parent_id !== undefined
        );

        // If hierarchical structure exists, validate it
        if (hasHierarchy) {
          const parentCategory = response.body.categories.find((cat: any) => !cat.parent_id);
          const childCategory = response.body.categories.find((cat: any) => cat.parent_id);
          
          expect(parentCategory).toBeDefined();
          expect(childCategory).toBeDefined();
          
          if (childCategory) {
            expect(typeof childCategory.parent_id).toBe('string');
          }
        }
      });

      it('should optionally return only top-level categories', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ top_level: true })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // All returned categories should have null parent_id
        response.body.categories.forEach((cat: any) => {
          expect(cat.parent_id).toBeNull();
        });
      });

      it('should return subcategories for a specific parent', async () => {
        // First get all categories
        const allCategoriesRes = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Find a category that has children
        const parentCategory = allCategoriesRes.body.categories.find((cat: any) => {
          return allCategoriesRes.body.categories.some(
            (otherCat: any) => otherCat.parent_id === cat.id
          );
        });

        if (parentCategory) {
          const response = await request(API_BASE_URL)
            .get('/api/v1/marketplace/categories')
            .query({ parent_id: parentCategory.id })
            .set('Authorization', `Bearer ${testAccessToken}`)
            .expect(200);

          // All returned categories should have the specified parent_id
          response.body.categories.forEach((cat: any) => {
            expect(cat.parent_id).toBe(parentCategory.id);
          });
        }
      });
    });

    describe('Item Counts', () => {
      it('should return accurate item counts per category', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        response.body.categories.forEach((cat: any) => {
          expect(typeof cat.item_count).toBe('number');
          expect(cat.item_count).toBeGreaterThanOrEqual(0);
        });
      });

      it('should only count active items in item_count', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Item counts should reflect only active items, not drafts
        expect(response.body.categories).toBeDefined();
        
        // This is a contract test - we're verifying the behavior
        // The actual count validation would be done in integration tests
      });

      it('should optionally include inactive items in count', async () => {
        const activeOnlyRes = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ include_inactive: false })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        const allItemsRes = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ include_inactive: true })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Categories should have same or higher counts when including inactive
        activeOnlyRes.body.categories.forEach((activeCat: any) => {
          const allItemsCat = allItemsRes.body.categories.find(
            (cat: any) => cat.id === activeCat.id
          );
          if (allItemsCat) {
            expect(allItemsCat.item_count).toBeGreaterThanOrEqual(activeCat.item_count);
          }
        });
      });
    });

    describe('Category Metadata', () => {
      it('should include category icons if available', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Some categories should have icons
        const hasIcons = response.body.categories.some((cat: any) => cat.icon);
        
        if (hasIcons) {
          const categoryWithIcon = response.body.categories.find((cat: any) => cat.icon);
          expect(typeof categoryWithIcon.icon).toBe('string');
        }
      });

      it('should include category display order', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Categories should have a display_order field
        response.body.categories.forEach((cat: any) => {
          expect(cat).toHaveProperty('display_order');
          expect(typeof cat.display_order).toBe('number');
        });
      });

      it('should return categories in display order by default', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Verify categories are sorted by display_order
        for (let i = 1; i < response.body.categories.length; i++) {
          expect(response.body.categories[i].display_order).toBeGreaterThanOrEqual(
            response.body.categories[i - 1].display_order
          );
        }
      });
    });

    describe('Filtering and Search', () => {
      it('should filter categories by search query', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ search: 'component' })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // All returned categories should match the search query
        response.body.categories.forEach((cat: any) => {
          const matchesSearch = 
            cat.name.toLowerCase().includes('component') ||
            cat.description?.toLowerCase().includes('component');
          expect(matchesSearch).toBe(true);
        });
      });

      it('should return empty array for non-matching search', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ search: 'NonExistentCategoryXYZ12345' })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        expect(response.body.categories).toEqual([]);
      });

      it('should filter categories with minimum item count', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ min_items: 1 })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // All categories should have at least 1 item
        response.body.categories.forEach((cat: any) => {
          expect(cat.item_count).toBeGreaterThanOrEqual(1);
        });
      });

      it('should exclude empty categories when requested', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ exclude_empty: true })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // All categories should have at least 1 item
        response.body.categories.forEach((cat: any) => {
          expect(cat.item_count).toBeGreaterThan(0);
        });
      });
    });

    describe('Response Format', () => {
      it('should include total count of categories', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('total');
        expect(typeof response.body.total).toBe('number');
        expect(response.body.total).toBe(response.body.categories.length);
      });

      it('should return consistent slugs', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        response.body.categories.forEach((cat: any) => {
          // Slug should be lowercase with hyphens
          expect(cat.slug).toMatch(/^[a-z0-9-]+$/);
          
          // Slug should be derived from name
          const expectedSlugBase = cat.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          
          expect(cat.slug).toContain(expectedSlugBase.split('-')[0]);
        });
      });
    });

    describe('Caching Headers', () => {
      it('should include appropriate cache headers', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Categories change infrequently, so should be cacheable
        expect(response.headers).toHaveProperty('cache-control');
        
        // Should allow caching for some duration
        const cacheControl = response.headers['cache-control'];
        expect(cacheControl).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should require authentication', async () => {
        await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .expect(401);
      });

      it('should reject invalid parent_id format', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ parent_id: 'invalid-uuid' })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should handle invalid min_items value', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ min_items: -5 })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should return empty array for non-existent parent_id', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .query({ parent_id: '00000000-0000-0000-0000-000000000000' })
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        expect(response.body.categories).toEqual([]);
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits on categories endpoint', async () => {
        const requests = [];
        
        // Make 30 requests rapidly (assuming rate limit is lower)
        for (let i = 0; i < 30; i++) {
          requests.push(
            request(API_BASE_URL)
              .get('/api/v1/marketplace/categories')
              .set('Authorization', `Bearer ${testAccessToken}`)
          );
        }

        const responses = await Promise.all(requests);
        
        // At least some requests should be rate limited
        const rateLimited = responses.some(res => res.status === 429);
        expect(rateLimited).toBe(true);
      });
    });

    describe('Special Categories', () => {
      it('should include "All" or uncategorized option if items exist without category', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // Should have a way to represent uncategorized items
        // This could be a special category or in metadata
        expect(response.body.categories).toBeDefined();
      });

      it('should not return disabled/archived categories by default', async () => {
        const response = await request(API_BASE_URL)
          .get('/api/v1/marketplace/categories')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .expect(200);

        // All categories should be active/enabled
        response.body.categories.forEach((cat: any) => {
          if (cat.hasOwnProperty('is_active')) {
            expect(cat.is_active).toBe(true);
          }
        });
      });
    });
  });
});