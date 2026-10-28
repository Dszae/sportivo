import type { APIRoute } from 'astro';
import {
  VAPID_PUBLIC_KEY,
  saveSubscription,
  removeSubscription,
  sendWebPush,
  type StoredSubscription,
} from '../../../lib/pushServer';

export const prerender = false;

// GET: Return public VAPID key for client pushManager.subscribe()
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      publicKey: VAPID_PUBLIC_KEY,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
};

// POST: Register or update Web Push subscription
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { subscription, preferences, test } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return new Response(
        JSON.stringify({ error: 'Invalid push subscription payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const storedSub: StoredSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      preferences: preferences || {
        favoriteTeams: [],
        starredMatches: [],
        timeZone: 'Asia/Kathmandu',
        notifications: {
          enabled: true,
          remind30Min: true,
          remind5Min: true,
          notifyKickoff: true,
          notifyGoalsWickets: true,
          notifyCards: true,
          notifyHalfTime: true,
          notifyFullTime: true,
        },
      },
      updatedAt: Date.now(),
    };

    saveSubscription(storedSub);

    // If client requested a test notification, send it immediately
    if (test) {
      await sendWebPush(storedSub, {
        title: '🔔 Sportivo Push Activated!',
        message: 'You will now receive match alerts even when Sportivo is closed.',
        matchTitle: 'Sportivo Background Match Service',
        matchUrl: '/dashboard/',
        category: 'general',
        key: `test-push-${Date.now()}`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Push subscription registered successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to register subscription' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// DELETE: Unsubscribe
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (body.endpoint) {
      removeSubscription(body.endpoint);
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to delete' }), { status: 500 });
  }
};

