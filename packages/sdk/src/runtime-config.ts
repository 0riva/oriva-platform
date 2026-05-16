import type { CreateClientConfig } from './generated/client.gen.js';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: config?.baseUrl ?? process.env.ORIVA_API_BASE_URL ?? 'https://api.oriva.io',
});
