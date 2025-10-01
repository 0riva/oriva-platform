// Tasks: T013-T017 - Integration tests for notification synchronization (TDD - must fail before implementation)
// Description: Test cross-app notification workflows, state management, and synchronization

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Integration: Notification Synchronization', () => {
  let supabase: any;
  let testApiKey: string;
  let testAppId: string;
  let testUserId: string;
  let workBuddyAppId: string;
  let workBuddyApiKey: string;
  let hugoAiAppId: string;
  let hugoAiApiKey: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testUserId = process.env.TEST_USER_ID || 'test-user-id';

    workBuddyAppId = 'work-buddy';
    workBuddyApiKey = 'work_buddy_api_key';

    hugoAiAppId = 'hugo-ai';
    hugoAiApiKey = 'hugo_ai_api_key';
  });

  afterAll(async () => {
    // Cleanup test data
    if (supabase) {
      await supabase.from('notification_state').delete().eq('user_id', testUserId);
      await supabase.from('platform_notifications').delete().eq('user_id', testUserId);
      await supabase.from('platform_events').delete().eq('user_id', testUserId);
    }
  });

  // T013: Third-party app creates notification
  describe('T013: Third-party app creates notification', () => {
    it('should create notification from Work Buddy and verify full workflow', async () => {
      // Step 1: Work Buddy creates session reminder notification
      const notification = {
        user_id: testUserId,
        title: 'Session Starting Soon',
        body: 'Your focus session starts in 5 minutes',
        priority: 'high',
        category: 'reminder',
        external_id: `work_buddy_session_${Date.now()}`,
        action_url: 'workbuddy://session/start',
        metadata: { session_id: 'ses_123', duration_minutes: 25 },
      };

      const createResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${workBuddyAppId}/notifications`)
        .set('Authorization', `Bearer ${workBuddyApiKey}`)
        .send(notification)
        .expect(201);

      expect(createResponse.body).toHaveProperty('notification_id');
      const notificationId = createResponse.body.notification_id;

      // Step 2: Verify notification created in platform_notifications table
      const { data: dbNotification } = await supabase
        .from('platform_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      expect(dbNotification).toBeDefined();
      expect(dbNotification.app_id).toBe(workBuddyAppId);
      expect(dbNotification.user_id).toBe(testUserId);
      expect(dbNotification.title).toBe(notification.title);
      expect(dbNotification.priority).toBe('high');

      // Step 3: Verify notification_state created with status=unread
      const { data: notificationState } = await supabase
        .from('notification_state')
        .select('*')
        .eq('notification_id', notificationId)
        .eq('user_id', testUserId)
        .single();

      expect(notificationState).toBeDefined();
      expect(notificationState.status).toBe('unread');
      expect(notificationState.read_at).toBeNull();
      expect(notificationState.dismissed_at).toBeNull();

      // Step 4: Verify platform_event created with event_type=notification.created
      const { data: events } = await supabase
        .from('platform_events')
        .select('*')
        .eq('app_id', workBuddyAppId)
        .eq('entity_id', notificationId)
        .eq('event_type', 'created');

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);
      const createdEvent = events[0];
      expect(createdEvent.event_category).toBe('notification');
      expect(createdEvent.entity_type).toBe('notification');

      // Step 5: Verify notification appears in user's feed query
      const feedResponse = await request(API_BASE_URL)
        .get(`/api/v1/users/${testUserId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(feedResponse.body).toHaveProperty('notifications');
      const userNotification = feedResponse.body.notifications.find(
        (n: any) => n.notification_id === notificationId
      );
      expect(userNotification).toBeDefined();

      // Step 6: Verify app branding (icon, name) included in response
      expect(userNotification).toHaveProperty('app_name');
      expect(userNotification).toHaveProperty('app_icon_url');
      expect(userNotification.app_id).toBe(workBuddyAppId);
    });
  });

  // T014: User dismisses notification in Oriva Core
  describe('T014: User dismisses notification in Oriva Core', () => {
    let notificationId: string;
    let webhookId: string;

    beforeAll(async () => {
      // Create test notification
      const createResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Test Dismissal',
          body: 'This notification will be dismissed',
          priority: 'normal',
          external_id: `dismiss_test_${Date.now()}`,
        })
        .expect(201);

      notificationId = createResponse.body.notification_id;

      // Create webhook subscription for notification.dismissed
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: 'https://example.com/webhooks/oriva',
          subscribed_events: ['notification.dismissed'],
        })
        .expect(201);

      webhookId = webhookResponse.body.webhook_id;
    });

    it('should handle dismissal workflow and trigger webhooks', async () => {
      // Step 1: Dismiss notification via PATCH
      const dismissResponse = await request(API_BASE_URL)
        .patch(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ status: 'dismissed' })
        .expect(200);

      expect(dismissResponse.body.status).toBe('dismissed');

      // Step 2: Verify notification_state updated with dismissed_at timestamp
      const { data: state } = await supabase
        .from('notification_state')
        .select('*')
        .eq('notification_id', notificationId)
        .single();

      expect(state.status).toBe('dismissed');
      expect(state.dismissed_at).not.toBeNull();
      const dismissedAt = new Date(state.dismissed_at);
      expect(dismissedAt.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds

      // Step 3: Verify platform_event created with event_type=notification.dismissed
      const { data: events } = await supabase
        .from('platform_events')
        .select('*')
        .eq('entity_id', notificationId)
        .eq('event_type', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(events.length).toBe(1);
      expect(events[0].event_category).toBe('notification');

      // Step 4: Verify webhook delivery triggered
      // Note: In real implementation, this would be async via background worker
      const { data: deliveryLogs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(deliveryLogs.length).toBeGreaterThan(0);
      expect(deliveryLogs[0].event_type).toBe('notification.dismissed');

      // Step 5: Verify notification no longer in unread feed
      const feedResponse = await request(API_BASE_URL)
        .get(`/api/v1/users/${testUserId}/notifications?status=unread`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      const dismissedNotification = feedResponse.body.notifications.find(
        (n: any) => n.notification_id === notificationId
      );
      expect(dismissedNotification).toBeUndefined();
    });
  });

  // T015: User dismisses notification in third-party app
  describe('T015: User dismisses notification in third-party app', () => {
    let notificationId: string;

    beforeAll(async () => {
      // Create notification visible in both apps
      const createResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${workBuddyAppId}/notifications`)
        .set('Authorization', `Bearer ${workBuddyApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Cross-App Notification',
          body: 'This notification is visible across apps',
          priority: 'normal',
          external_id: `cross_app_${Date.now()}`,
        })
        .expect(201);

      notificationId = createResponse.body.notification_id;
    });

    it('should sync dismissal from third-party app to Oriva Core', async () => {
      // Step 1: Mock Work Buddy dismissing notification
      const dismissResponse = await request(API_BASE_URL)
        .patch(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${workBuddyApiKey}`)
        .send({ status: 'dismissed' })
        .expect(200);

      expect(dismissResponse.body.status).toBe('dismissed');

      // Step 2: Verify notification_state updated
      const { data: state } = await supabase
        .from('notification_state')
        .select('*')
        .eq('notification_id', notificationId)
        .single();

      expect(state.status).toBe('dismissed');

      // Step 3: Verify Oriva Core query no longer returns notification
      const coreResponse = await request(API_BASE_URL)
        .get(`/api/v1/users/${testUserId}/notifications?status=unread`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      const foundNotification = coreResponse.body.notifications.find(
        (n: any) => n.notification_id === notificationId
      );
      expect(foundNotification).toBeUndefined();

      // Step 4: Verify idempotent operation (dismiss twice = same result)
      const secondDismiss = await request(API_BASE_URL)
        .patch(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${workBuddyApiKey}`)
        .send({ status: 'dismissed' })
        .expect(200);

      expect(secondDismiss.body.status).toBe('dismissed');

      // Verify dismissed_at timestamp didn't change
      const { data: stateAfterSecondDismiss } = await supabase
        .from('notification_state')
        .select('*')
        .eq('notification_id', notificationId)
        .single();

      expect(stateAfterSecondDismiss.dismissed_at).toBe(state.dismissed_at);
    });
  });

  // T016: User clicks notification action
  describe('T016: User clicks notification action', () => {
    let notificationId: string;
    let webhookId: string;

    beforeAll(async () => {
      // Create notification with action_url
      const createResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Action Required',
          body: 'Click to complete your task',
          priority: 'high',
          action_url: 'https://app.example.com/task/123',
          external_id: `action_click_${Date.now()}`,
        })
        .expect(201);

      notificationId = createResponse.body.notification_id;

      // Create webhook subscription for notification.clicked
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: 'https://example.com/webhooks/clicks',
          subscribed_events: ['notification.clicked'],
        })
        .expect(201);

      webhookId = webhookResponse.body.webhook_id;
    });

    it('should handle click action and record event data', async () => {
      // Step 1: Mark notification as clicked
      const clickResponse = await request(API_BASE_URL)
        .patch(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ status: 'clicked', metadata: { click_source: 'mobile_app' } })
        .expect(200);

      expect(clickResponse.body.status).toBe('clicked');

      // Step 2: Verify notification_state updated with clicked_at timestamp
      const { data: state } = await supabase
        .from('notification_state')
        .select('*')
        .eq('notification_id', notificationId)
        .single();

      expect(state.status).toBe('clicked');
      expect(state.clicked_at).not.toBeNull();
      expect(state.read_at).not.toBeNull(); // Clicking implies reading

      // Step 3: Verify platform_event created with event_type=notification.clicked
      const { data: events } = await supabase
        .from('platform_events')
        .select('*')
        .eq('entity_id', notificationId)
        .eq('event_type', 'clicked')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(events.length).toBe(1);
      expect(events[0].event_category).toBe('notification');

      // Step 4: Verify webhook delivery triggered
      const { data: deliveryLogs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(deliveryLogs.length).toBeGreaterThan(0);
      expect(deliveryLogs[0].event_type).toBe('notification.clicked');

      // Step 5: Verify click action recorded in event_data
      expect(events[0].event_data).toHaveProperty('click_source');
      expect(events[0].event_data.click_source).toBe('mobile_app');
    });
  });

  // T017: Multiple apps send notifications
  describe('T017: Multiple apps send notifications', () => {
    let workBuddyNotifId: string;
    let hugoAiNotifId: string;
    let testAppNotifId: string;

    beforeAll(async () => {
      // Create notification from Work Buddy
      const workBuddyResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${workBuddyAppId}/notifications`)
        .set('Authorization', `Bearer ${workBuddyApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Focus Session Complete',
          body: 'Great job! You completed your focus session.',
          priority: 'low',
          external_id: `wb_multi_${Date.now()}`,
        })
        .expect(201);

      workBuddyNotifId = workBuddyResponse.body.notification_id;

      // Create notification from Hugo AI
      const hugoResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${hugoAiAppId}/notifications`)
        .set('Authorization', `Bearer ${hugoAiApiKey}`)
        .send({
          user_id: testUserId,
          title: 'New Chat Message',
          body: 'Hugo: I found some interesting insights for you.',
          priority: 'high',
          external_id: `hugo_multi_${Date.now()}`,
        })
        .expect(201);

      hugoAiNotifId = hugoResponse.body.notification_id;

      // Create notification from test app
      const testResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'System Update',
          body: 'A new version is available.',
          priority: 'normal',
          external_id: `test_multi_${Date.now()}`,
        })
        .expect(201);

      testAppNotifId = testResponse.body.notification_id;
    });

    it('should aggregate notifications from multiple apps with proper sorting', async () => {
      // Step 1: Query GET /api/v1/users/:userId/notifications
      const feedResponse = await request(API_BASE_URL)
        .get(`/api/v1/users/${testUserId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      expect(feedResponse.body).toHaveProperty('notifications');
      const notifications = feedResponse.body.notifications;

      // Step 2: Verify all notifications returned
      const notificationIds = notifications.map((n: any) => n.notification_id);
      expect(notificationIds).toContain(workBuddyNotifId);
      expect(notificationIds).toContain(hugoAiNotifId);
      expect(notificationIds).toContain(testAppNotifId);

      // Step 3: Verify sorted by priority then created_at
      // Priority order: critical > high > normal > low
      const hugoNotif = notifications.find((n: any) => n.notification_id === hugoAiNotifId);
      const testNotif = notifications.find((n: any) => n.notification_id === testAppNotifId);
      const workBuddyNotif = notifications.find((n: any) => n.notification_id === workBuddyNotifId);

      const hugoIndex = notifications.indexOf(hugoNotif);
      const testIndex = notifications.indexOf(testNotif);
      const workBuddyIndex = notifications.indexOf(workBuddyNotif);

      expect(hugoIndex).toBeLessThan(testIndex); // high before normal
      expect(testIndex).toBeLessThan(workBuddyIndex); // normal before low

      // Step 4: Verify each notification includes app branding
      notifications.forEach((notif: any) => {
        expect(notif).toHaveProperty('app_id');
        expect(notif).toHaveProperty('app_name');
        expect(notif).toHaveProperty('app_icon_url');
      });

      // Step 5: Verify filtering by app_id works
      const workBuddyOnlyResponse = await request(API_BASE_URL)
        .get(`/api/v1/users/${testUserId}/notifications?app_id=${workBuddyAppId}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .expect(200);

      const workBuddyNotifications = workBuddyOnlyResponse.body.notifications;
      workBuddyNotifications.forEach((notif: any) => {
        expect(notif.app_id).toBe(workBuddyAppId);
      });

      expect(workBuddyNotifications.some((n: any) => n.notification_id === workBuddyNotifId)).toBe(true);
      expect(workBuddyNotifications.some((n: any) => n.notification_id === hugoAiNotifId)).toBe(false);
      expect(workBuddyNotifications.some((n: any) => n.notification_id === testAppNotifId)).toBe(false);
    });
  });
});
