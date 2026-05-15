import { z } from 'zod';
import { registry } from '../registry';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const EventSchema = registry.register(
  'Event',
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    location: z.string().nullable(),
    isOnline: z.boolean(),
    category: z.string(),
    organizer: z.string().uuid(),
    maxAttendees: z.number().int().nullable(),
    currentAttendees: z.number().int().nullable(),
    price: z.number().min(0),
    tags: z.array(z.string()),
    imageUrl: z.string().url().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

const EventIdParamSchema = z.object({ eventId: z.string().uuid() });

// POST body — required fields validated inline by handler
export const CreateEventBodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isOnline: z.boolean(),
    category: z.string().min(1),
    location: z.string().nullable().optional(),
    maxAttendees: z.number().int().positive().nullable().optional(),
    price: z.number().min(0).optional(),
    tags: z.array(z.string()).max(20).optional(),
    imageUrl: z.string().url().nullable().optional(),
  })
  .passthrough();

// ── Path registrations ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/oriva/events',
  operationId: 'listEvents',
  tags: ['Events'],
  summary: 'List events',
  description: 'Returns active events with optional filtering by category and date range.',
  request: {
    query: z.object({
      category: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.number().int().max(100).default(20).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Events list',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(EventSchema),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/oriva/events/{eventId}',
  operationId: 'getEvent',
  tags: ['Events'],
  summary: 'Get event',
  request: { params: EventIdParamSchema },
  responses: {
    200: {
      description: 'Event details',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: EventSchema,
          }),
        },
      },
    },
    404: { description: 'Event not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/oriva/events',
  operationId: 'createEvent',
  tags: ['Events'],
  summary: 'Create event',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateEventBodySchema } } },
  },
  responses: {
    201: {
      description: 'Event created',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: EventSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'Validation error — missing required fields or invalid category' },
    401: { description: 'Unauthorized' },
  },
});
