import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../claudedocs/openapi-snapshot.json',
  output: {
    path: 'src/generated',
    importFileExtension: '.js',
  },
  postProcess: ['prettier'],
  plugins: [
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: './src/runtime-config.js',
    },
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
