// Task: T020 - Integration test for real-time WebSocket notification updates (TDD - must fail before implementation)
// Description: Test WebSocket broadcasting of notification events across multiple clients

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const WS_BASE_URL = process.env.TEST_WS_URL || 'ws://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Integration: Real-time Notification Updates via WebSocket', () => {
  let supabase: any;
  let testApiKey: string;
  let testAppId: string;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testUserId = process.env.TEST_USER_ID || 'test-user-id';
  });

  afterAll(async () => {
    // Cleanup test data
    if (supabase) {
      await supabase.from('notification_state').delete().eq('user_id', testUserId);
      await supabase.from('platform_notifications').delete().eq('user_id', testUserId);
      await supabase.from('platform_events').delete().eq('user_id', testUserId);
    }
  });

  // T020: Real-time notification updates
  describe('T020: Real-time notification updates', () => {
    it('should broadcast notification events to multiple WebSocket clients', async (done) => {
      let client1: WebSocket;
      let client2: WebSocket;
      let notificationId: string;

      const client1Events: any[] = [];
      const client2Events: any[] = [];

      let client1Connected = false;
      let client2Connected = false;

      const checkCompletion = () => {
        // Test is complete when both clients receive both events (create + dismiss)
        if (client1Events.length >= 2 && client2Events.length >= 2) {
          client1.close();
          client2.close();
          done();
        }
      };

      // Step 1: Connect first WebSocket client for test user
      client1 = new WebSocket(
        `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
      );

      client1.on('open', () => {
        client1Connected = true;

        // Subscribe to notification events
        client1.send(
          JSON.stringify({
            type: 'subscribe',
            event_category: 'notification',
          })
        );

        // Step 2: Connect second WebSocket client for same user
        client2 = new WebSocket(
          `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
        );

        client2.on('open', () => {
          client2Connected = true;

          // Subscribe to notification events
          client2.send(
            JSON.stringify({
              type: 'subscribe',
              event_category: 'notification',
            })
          );

          // Wait for subscriptions to be acknowledged
          setTimeout(async () => {
            // Step 3: Create notification via POST
            const createResponse = await request(API_BASE_URL)
              .post(`/api/v1/apps/${testAppId}/notifications`)
              .set('Authorization', `Bearer ${testApiKey}`)
              .send({
                user_id: testUserId,
                title: 'Real-time Test Notification',
                body: 'This notification should be received by both WebSocket clients',
                priority: 'high',
                external_id: `realtime_test_${Date.now()}`,
              })
              .expect(201);

            notificationId = createResponse.body.notification_id;
          }, 500);
        });

        client2.on('message', (data) => {
          const event = JSON.parse(data.toString());

          if (event.type === 'event' && event.event_category === 'notification') {
            client2Events.push(event);

            // Step 5: After both clients receive create event, dismiss from client 1
            if (
              client2Events.length === 1 &&
              client1Events.length === 1 &&
              event.event_type === 'created'
            ) {
              setTimeout(async () => {
                await request(API_BASE_URL)
                  .patch(`/api/v1/notifications/${notificationId}`)
                  .set('Authorization', `Bearer ${testApiKey}`)
                  .send({ status: 'dismissed' })
                  .expect(200);
              }, 500);
            }

            checkCompletion();
          }
        });

        client2.on('error', (error) => {
          done(error);
        });
      });

      client1.on('message', (data) => {
        const event = JSON.parse(data.toString());

        if (event.type === 'event' && event.event_category === 'notification') {
          client1Events.push(event);
          checkCompletion();
        }
      });

      client1.on('error', (error) => {
        done(error);
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (client1Events.length < 2 || client2Events.length < 2) {
          client1?.close();
          client2?.close();
          done(
            new Error(
              `Test timeout: client1 received ${client1Events.length} events, client2 received ${client2Events.length} events`
            )
          );
        }
      }, 15000);

      // Final verification after both clients receive both events
      setTimeout(() => {
        // Step 4: Verify both WebSocket clients receive real-time notification event
        expect(client1Events.length).toBeGreaterThanOrEqual(2);
        expect(client2Events.length).toBeGreaterThanOrEqual(2);

        // Verify notification.created event
        const client1CreateEvent = client1Events.find((e) => e.event_type === 'created');
        const client2CreateEvent = client2Events.find((e) => e.event_type === 'created');

        expect(client1CreateEvent).toBeDefined();
        expect(client2CreateEvent).toBeDefined();

        expect(client1CreateEvent.entity_type).toBe('notification');
        expect(client1CreateEvent.entity_id).toBe(notificationId);
        expect(client2CreateEvent.entity_id).toBe(notificationId);

        // Step 6: Verify client 2 receives dismissal event immediately
        const client2DismissEvent = client2Events.find((e) => e.event_type === 'dismissed');
        expect(client2DismissEvent).toBeDefined();
        expect(client2DismissEvent.entity_id).toBe(notificationId);

        // Verify client 1 also receives dismissal event
        const client1DismissEvent = client1Events.find((e) => e.event_type === 'dismissed');
        expect(client1DismissEvent).toBeDefined();
        expect(client1DismissEvent.entity_id).toBe(notificationId);
      }, 14000);
    }, 20000);

    it('should handle notification expiry and remove from all clients', async (done) => {
      let client1: WebSocket;
      let client2: WebSocket;
      let notificationId: string;

      const client1Events: any[] = [];
      const client2Events: any[] = [];

      // Connect two WebSocket clients
      client1 = new WebSocket(
        `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
      );

      client1.on('open', () => {
        client1.send(JSON.stringify({ type: 'subscribe', event_category: 'notification' }));

        client2 = new WebSocket(
          `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
        );

        client2.on('open', () => {
          client2.send(JSON.stringify({ type: 'subscribe', event_category: 'notification' }));

          setTimeout(async () => {
            // Create notification with 5-second expiry
            const createResponse = await request(API_BASE_URL)
              .post(`/api/v1/apps/${testAppId}/notifications`)
              .set('Authorization', `Bearer ${testApiKey}`)
              .send({
                user_id: testUserId,
                title: 'Expiring Notification',
                body: 'This notification will expire in 5 seconds',
                priority: 'normal',
                expires_at: new Date(Date.now() + 5000).toISOString(),
                external_id: `expiry_test_${Date.now()}`,
              })
              .expect(201);

            notificationId = createResponse.body.notification_id;
          }, 500);
        });

        client2.on('message', (data) => {
          const event = JSON.parse(data.toString());
          if (event.type === 'event' && event.event_category === 'notification') {
            client2Events.push(event);
          }
        });

        client2.on('error', (error) => {
          done(error);
        });
      });

      client1.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === 'event' && event.event_category === 'notification') {
          client1Events.push(event);
        }
      });

      client1.on('error', (error) => {
        done(error);
      });

      // Wait for expiry and verify both clients receive expiry event
      setTimeout(() => {
        // Verify both clients received creation event
        expect(client1Events.some((e) => e.event_type === 'created')).toBe(true);
        expect(client2Events.some((e) => e.event_type === 'created')).toBe(true);

        // Step 7: Verify notification expiry removes from all clients
        // Both clients should receive an expiry/dismissed event
        const client1ExpiryEvent = client1Events.find(
          (e) => e.entity_id === notificationId && (e.event_type === 'expired' || e.event_type === 'dismissed')
        );
        const client2ExpiryEvent = client2Events.find(
          (e) => e.entity_id === notificationId && (e.event_type === 'expired' || e.event_type === 'dismissed')
        );

        expect(client1ExpiryEvent).toBeDefined();
        expect(client2ExpiryEvent).toBeDefined();

        client1.close();
        client2.close();
        done();
      }, 8000);
    }, 15000);

    it('should enforce per-user connection limits', async (done) => {
      const connections: WebSocket[] = [];
      let rejectedConnection: WebSocket | null = null;

      // Create 10 connections (assuming limit is 10)
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(
          `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
        );
        connections.push(ws);
      }

      // Wait for all connections to open
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to create 11th connection - should be rejected
      rejectedConnection = new WebSocket(
        `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
      );

      rejectedConnection.on('close', (code) => {
        // Connection should be closed due to limit exceeded
        expect(code).toBeGreaterThan(1000);

        // Cleanup
        connections.forEach((ws) => ws.close());
        done();
      });

      rejectedConnection.on('error', () => {
        // Expected - connection rejected
        connections.forEach((ws) => ws.close());
        done();
      });

      // Timeout
      setTimeout(() => {
        connections.forEach((ws) => ws.close());
        rejectedConnection?.close();
        done(new Error('Connection limit test timeout'));
      }, 5000);
    }, 10000);

    it('should maintain connection state across reconnects', async (done) => {
      let client: WebSocket;
      const receivedEvents: any[] = [];
      let notificationId: string;

      // Step 1: Connect and subscribe
      client = new WebSocket(
        `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
      );

      client.on('open', () => {
        client.send(JSON.stringify({ type: 'subscribe', event_category: 'notification' }));

        setTimeout(async () => {
          // Create notification
          const createResponse = await request(API_BASE_URL)
            .post(`/api/v1/apps/${testAppId}/notifications`)
            .set('Authorization', `Bearer ${testApiKey}`)
            .send({
              user_id: testUserId,
              title: 'Reconnect Test',
              body: 'Testing connection state',
              priority: 'normal',
              external_id: `reconnect_test_${Date.now()}`,
            })
            .expect(201);

          notificationId = createResponse.body.notification_id;
        }, 500);
      });

      client.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === 'event') {
          receivedEvents.push(event);

          // After receiving create event, disconnect
          if (event.event_type === 'created' && receivedEvents.length === 1) {
            client.close();

            // Reconnect after 1 second
            setTimeout(() => {
              const newClient = new WebSocket(
                `${WS_BASE_URL}/api/v1/events/stream?app_id=${testAppId}&user_id=${testUserId}&auth=${testApiKey}`
              );

              newClient.on('open', () => {
                newClient.send(
                  JSON.stringify({ type: 'subscribe', event_category: 'notification' })
                );

                // Dismiss notification
                setTimeout(async () => {
                  await request(API_BASE_URL)
                    .patch(`/api/v1/notifications/${notificationId}`)
                    .set('Authorization', `Bearer ${testApiKey}`)
                    .send({ status: 'dismissed' })
                    .expect(200);
                }, 500);
              });

              newClient.on('message', (data) => {
                const event = JSON.parse(data.toString());
                if (event.type === 'event' && event.event_type === 'dismissed') {
                  receivedEvents.push(event);

                  // Verify both events received
                  expect(receivedEvents.length).toBe(2);
                  expect(receivedEvents[0].event_type).toBe('created');
                  expect(receivedEvents[1].event_type).toBe('dismissed');

                  newClient.close();
                  done();
                }
              });

              newClient.on('error', (error) => {
                done(error);
              });
            }, 1000);
          }
        }
      });

      client.on('error', (error) => {
        done(error);
      });

      setTimeout(() => {
        done(new Error('Reconnect test timeout'));
      }, 10000);
    }, 15000);
  });
});
