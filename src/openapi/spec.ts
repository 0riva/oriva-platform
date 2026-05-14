import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';

// Import all schema files — each one registers its paths and components as a side effect
import './schemas/user';
import './schemas/profiles';
import './schemas/groups';

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Oriva Platform API',
    version: '1.0.0',
    description:
      'Public API for 3rd party Oriva developers. Authenticate with your API key as a Bearer token.',
  },
  servers: [
    { url: 'https://api.oriva.io', description: 'Production' },
    { url: 'http://localhost:3002', description: 'Local BFF proxy' },
  ],
});
