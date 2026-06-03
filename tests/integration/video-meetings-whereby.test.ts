/**
 * Video Meetings — Whereby proxy route tests.
 *
 * The Whereby proxy lives behind the authenticated video-meetings BFF router. These
 * tests mount the router with auth stubbed and global.fetch mocked, and assert the
 * key behaviours: the WHEREBY_API_KEY guard and the server-side forward to Whereby.
 */
import express from 'express';
import request from 'supertest';

// Stub the shared auth so the router's `router.use(requireAuth)` is a no-op that
// still populates keyInfo, isolating the Whereby proxy logic under test.
jest.mock('../../src/express/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.keyInfo = { userId: 'test-user' };
    next();
  },
}));

import videoMeetingsRouter from '../../src/express/routes/video-meetings';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/video-meetings', videoMeetingsRouter);
  return app;
}

describe('video-meetings Whereby proxy', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.WHEREBY_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.WHEREBY_API_KEY;
    } else {
      process.env.WHEREBY_API_KEY = originalKey;
    }
    jest.clearAllMocks();
  });

  it('returns 503 when WHEREBY_API_KEY is not configured', async () => {
    delete process.env.WHEREBY_API_KEY;
    const res = await request(buildApp()).post('/api/v1/video-meetings/whereby/rooms').send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('WHEREBY_NOT_CONFIGURED');
  });

  it('forwards to Whereby and returns the created room on success', async () => {
    process.env.WHEREBY_API_KEY = 'test-key';
    const room = {
      meetingId: 'm-1',
      roomUrl: 'https://whereby.com/room',
      hostRoomUrl: 'https://whereby.com/host',
      startDate: '2026-06-02T00:00:00Z',
      endDate: '2026-06-03T00:00:00Z',
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => room,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await request(buildApp())
      .post('/api/v1/video-meetings/whereby/rooms')
      .send({ roomMode: 'group' });

    expect(res.status).toBe(201);
    expect(res.body.meetingId).toBe('m-1');
    // Calls Whereby's meetings endpoint with the server-side key.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.whereby.dev/v1/meetings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('propagates a Whereby error status', async () => {
    process.env.WHEREBY_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'bad request' }),
    }) as unknown as typeof fetch;

    const res = await request(buildApp())
      .post('/api/v1/video-meetings/whereby/rooms')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('WHEREBY_ERROR');
  });

  it('deletes a Whereby room', async () => {
    process.env.WHEREBY_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await request(buildApp()).delete('/api/v1/video-meetings/whereby/rooms/m-1');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.whereby.dev/v1/meetings/m-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
