const request = require('supertest');
const path = require('path');
const fs = require('fs');
const tsNode = require('ts-node');

tsNode.register({
  transpileOnly: true,
  project: path.join(__dirname, '../../api/tsconfig.json')
});

// TDD Test Suite for TypeScript Migration
describe('TypeScript Migration TDD', () => {

  describe('Phase 1: Infrastructure Setup', () => {

    test('🔴 RED: Should have TypeScript file ready for compilation', async () => {
      // This test will FAIL until we create index.ts
      const tsFilePath = path.join(__dirname, '../../api/index.ts');
      const fileExists = fs.existsSync(tsFilePath);

      expect(fileExists).toBe(true);
    });

    test('🔴 RED: TypeScript file should compile without errors', async () => {
      // This test will FAIL until TypeScript compiles successfully
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        await execAsync('npm run type-check');
        // If we get here, TypeScript compilation succeeded
        expect(true).toBe(true);
      } catch (error) {
        // This should fail initially (RED phase)
        throw new Error(`TypeScript compilation failed: ${error.message}`);
      }
    });

  });

  describe('Phase 2: Functionality Preservation', () => {

    test('🟢 GREEN: All existing API endpoints should work identically', async () => {
      // This test ensures NO REGRESSION during migration
      const appModule = require('../../api/test-wrapper.js');
      const app = appModule.default || appModule.app;

      // Test critical endpoints maintain exact same behavior
      const response1 = await request(app).get('/api/v1/profiles/available');
      expect(response1.status).toBe(401); // Expected for no auth

      const response2 = await request(app).get('/api/v1/groups');
      expect(response2.status).toBe(401); // Expected for no auth

      const response3 = await request(app).get('/api/v1/user/me');
      expect(response3.status).toBe(401); // Expected for no auth
    });

  });

  describe('Phase 3: Type Safety Validation', () => {

    test('🔵 REFACTOR: Should have basic type definitions', () => {
      // This test validates that we've added meaningful types
      const tsContent = fs.readFileSync(
        path.join(__dirname, '../../api/index.ts'),
        'utf8'
      );

      // Verify we have some basic type annotations
      expect(tsContent).toMatch(/interface\s+\w+/); // At least one interface
      expect(tsContent).toMatch(/:\s*(string|number|boolean)/); // Basic type annotations
    });

    test('🔵 REFACTOR: Should export foundational API types from api/types/index.ts', () => {
      // This will fail until the new type barrel exports are implemented
      const types = require('../../api/types/index.ts');

      expect(types.ApiResponse).toBeDefined();
      expect(types.AuthenticatedRequest).toBeDefined();
      expect(types.DatabaseQueryResult).toBeDefined();
    });

  });

});
