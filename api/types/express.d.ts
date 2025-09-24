import 'express-serve-static-core';
import type { ApiKeyInfo } from './middleware/auth';

declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: string;
    keyInfo?: ApiKeyInfo;
  }
}
