import type { Request, Response, NextFunction } from 'express';

export type AuthType = 'api_key' | 'supabase_auth';

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  usageCount: number;
  isActive: boolean;
  authType: AuthType;
  lastUsedAt?: string;
}

export interface AuthenticatedRequest<
  TParams = any,
  TResBody = any,
  TReqBody = any,
  TReqQuery = any,
  TLocals extends Record<string, any> = Record<string, any>
> extends Request<TParams, TResBody, TReqBody, TReqQuery, TLocals> {
  apiKey?: string;
  authToken?: string;
  keyInfo?: ApiKeyInfo;
}

export type ApiMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export const hasApiKeyInfo = (
  req: AuthenticatedRequest
): req is AuthenticatedRequest & { keyInfo: ApiKeyInfo } => Boolean(req.keyInfo);

export interface ApiKeyContext {
  apiKeyHash: string;
  keyInfo: ApiKeyInfo;
}

export type AuthenticatedHandler<TReturn = unknown> = (
  req: AuthenticatedRequest,
  res: Response
) => TReturn;
