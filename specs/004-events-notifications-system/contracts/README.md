# API Contracts

This directory contains OpenAPI 3.0 contract specifications for all Platform Events & Notifications System endpoints.

## Contracts Overview

### Event Publishing
- **events-publish.yml** - POST /api/v1/apps/:appId/events
- **events-query.yml** - GET /api/v1/apps/:appId/events
- **websocket-stream.yml** - WSS /api/v1/events/stream

### Notification Management
- **notifications-create.yml** - POST /api/v1/apps/:appId/notifications
- **notifications-query.yml** - GET /api/v1/users/:userId/notifications
- **notifications-update.yml** - PATCH /api/v1/notifications/:id
- **notifications-delete.yml** - DELETE /api/v1/notifications/:id

### Webhook Management
- **webhooks-create.yml** - POST /api/v1/apps/:appId/webhooks
- **webhooks-list.yml** - GET /api/v1/apps/:appId/webhooks
- **webhooks-update.yml** - PATCH /api/v1/apps/:appId/webhooks/:id
- **webhooks-delete.yml** - DELETE /api/v1/apps/:appId/webhooks/:id

## Contract Structure

Each contract file follows OpenAPI 3.0 specification and includes:

- **Path**: Endpoint URL with path parameters
- **Method**: HTTP method (GET, POST, PATCH, DELETE)
- **Security**: Authentication requirements (Bearer token)
- **Parameters**: Path, query, and header parameters
- **Request Body**: JSON schema with validation rules
- **Responses**: Success and error response schemas
- **Examples**: Request and response examples

## Contract Tests

Contract tests are located in `tests/contract/` and validate:
- Request/response schema compliance
- Authentication enforcement
- Rate limiting behavior
- Error response formats
- Validation rules

## Usage

These contracts are used for:

1. **TDD Development**: Write contract tests before implementation
2. **API Documentation**: Generate API docs from contracts
3. **Client Generation**: Generate TypeScript/SDK clients
4. **Validation**: Runtime request/response validation

## Validation

All contracts are validated against OpenAPI 3.0 schema using:
```bash
npm run validate:contracts
```

## Related Documents

- [data-model.md](../data-model.md) - Entity definitions
- [quickstart.md](../quickstart.md) - Developer quickstart guide
- [spec.md](../spec.md) - Feature specification
