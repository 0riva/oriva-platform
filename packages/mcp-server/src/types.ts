export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  example?: unknown;
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  nullable?: boolean;
  default?: unknown;
  $ref?: string;
  [k: string]: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface ProjectedOperation {
  toolName: string;
  path: string;
  method: HttpMethod;
  pathParams: string[];
  queryParams: string[];
  bodyFields: Array<{ alias: string; original: string }>;
}

export type OperationIndex = Map<string, ProjectedOperation>;

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: JsonSchema;
  description?: string;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: JsonSchema }>;
  };
}

export type OpenApiPaths = Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;

export interface OpenApiDoc {
  paths: OpenApiPaths;
  components?: { schemas?: Record<string, JsonSchema> };
}
