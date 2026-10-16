/*
 * Source of public/firebase-messaging-sw.js — browser notifications for the
 * dashboard while it is closed. Build with `npm run build:push-sw`; the
 * output is committed so a deploy never depends on the step being run.
 *
 * The Firebase SDK is bundled in rather than loaded with importScripts from
 * www.gstatic.com: the dashboard allows no third-party script origin, and a
 * service worker runs on every push whether a tab is open or not.
 *
 * The web-app config arrives in this script's own URL (`?config=<json>`),
 * set by PushService from the server's FIREBASE_WEB_CONFIG. Nothing in it is
 * secret — Firebase web config is public by design — and it keeps this file
 * the same on every deploy.
 */
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

let config = null;
try {
  config = JSON.parse(new URL(self.location.href).searchParams.get('config') || 'null');
} catch {
  config = null;
}

if (config && config.apiKey && config.messagingSenderId) {
  // Pushes carry a `notification` block, so with no dashboard tab focused the
  // SDK shows them itself, and a click opens `webpush.fcm_options.link`
  // (https://hayaihealthcare.com/dashboard/…), set by the backend.
  getMessaging(initializeApp(config));
}

// For a browser that ignores fcm_options: open the alert's dashboard route.
// Registered after the SDK's own handler, which stops the event when it has
// handled it, so this only runs when it did not.
self.addEventListener('notificationclick', event => {
  const path = event.notification?.data?.FCM_MSG?.data?.dashboard_path;
  if (typeof path !== 'string' || !path.startsWith('/dashboard/')) return;
  event.notification.close();
  event.waitUntil(self.clients.openWindow(path));
});

// A new version takes over at once instead of waiting for every tab to close.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
