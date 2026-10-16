import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Subject, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Browser notifications for admins, delivered while the dashboard is closed
 * (docs/backend-contract/admin-access-2026-10-16.md §9).
 *
 * The backend already pushes every admin alert over Firebase Cloud Messaging
 * to each device token the admin registered. This registers the browser:
 * a token from Firebase, sent to `POST /notifications/device-token`, removed
 * again on logout so the next person on the browser does not get the
 * previous admin's alerts.
 *
 * The Firebase web config and VAPID key are a server setting
 * (`FIREBASE_WEB_CONFIG`, printed into the admin shell as a meta tag), not a
 * build constant: without them the feature reads as not configured and the
 * button stays hidden, and adding them is a restart, not a rebuild.
 *
 * Firebase is imported on demand, so an admin who never turns this on never
 * downloads it.
 */

export type PushState =
  /** No Push API, or Firebase says this browser cannot (iOS outside the home screen). */
  | 'unsupported'
  /** The server has no Firebase config yet. */
  | 'unconfigured'
  | 'off'
  | 'on'
  /** The admin refused; only the browser's site settings can undo it. */
  | 'blocked';

interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  storageBucket?: string;
  vapidKey: string;
}

const TOKEN_KEY = 'fcm_web_token';
const SW_PATH = '/firebase-messaging-sw.js';
/** Narrower than the worker's folder: it controls no page of the public site. */
const SW_SCOPE = '/dashboard/';

@Injectable({ providedIn: 'root' })
export class PushService {
  private api = inject(ApiService);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = signal<PushState>('off');
  readonly busy = signal(false);
  /** A push that arrived while a dashboard tab had focus (Firebase shows nothing then). */
  readonly foreground = new Subject<{ title?: string; body?: string; data?: Record<string, string> }>();

  private listening = false;

  constructor() {
    this.state.set(this.initialState());
  }

  private config(): FirebaseWebConfig | null {
    if (!this.isBrowser) return null;
    const raw = this.document.querySelector('meta[name="hayai-firebase"]')?.getAttribute('content');
    if (!raw) return null;
    try {
      const c = JSON.parse(raw) as FirebaseWebConfig;
      return c.apiKey && c.messagingSenderId && c.appId && c.vapidKey ? c : null;
    } catch {
      return null;
    }
  }

  private initialState(): PushState {
    if (!this.isBrowser || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
    if (!this.config()) return 'unconfigured';
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' && this.storedToken() ? 'on' : 'off';
  }

  /**
   * After sign-in, and on every dashboard load. Only where the admin already
   * allowed notifications — a permission prompt that no click asked for is
   * ignored by browsers and annoys everyone else. Registering again is how a
   * rotated token reaches the API, and the endpoint moves a token to whoever
   * is signed in, so it is safe to repeat.
   */
  async resume(): Promise<void> {
    if (this.state() === 'unsupported' || this.state() === 'unconfigured') return;
    if (Notification.permission !== 'granted') return;
    try {
      await this.register();
    } catch {
      // Quiet: the button still offers to try again.
    }
  }

  /** From a click — the "Turn on notifications" button. */
  async enable(): Promise<PushState> {
    if (this.state() === 'unsupported' || this.state() === 'unconfigured') return this.state();
    this.busy.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'blocked' : 'off');
        return this.state();
      }
      await this.register();
      return this.state();
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Signing out. Must run while the session is still valid — the API needs
   * it to know whose token to drop. Never throws: a failure here must not
   * keep anyone signed in.
   */
  async unregister(): Promise<void> {
    const token = this.storedToken();
    if (!token) return;
    try {
      await firstValueFrom(this.api.delete('/notifications/device-token', { body: { token } }));
    } catch {
      // The next admin to sign in on this browser takes the token over anyway.
    }
    this.forgetToken();
    if (this.state() === 'on') this.state.set('off');
  }

  private async register(): Promise<void> {
    const config = this.config();
    if (!config) return;

    const [{ initializeApp, getApps }, messagingSdk] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging')
    ]);
    if (!(await messagingSdk.isSupported())) {
      this.state.set('unsupported');
      return;
    }

    const { vapidKey, ...webConfig } = config;
    const app = getApps()[0] ?? initializeApp(webConfig);
    const messaging = messagingSdk.getMessaging(app);
    const registration = await navigator.serviceWorker.register(
      `${SW_PATH}?config=${encodeURIComponent(JSON.stringify(webConfig))}`,
      { scope: SW_SCOPE }
    );
    const token = await messagingSdk.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return;

    await firstValueFrom(this.api.post('/notifications/device-token', { token, platform: 'web' }));
    this.storeToken(token);
    this.state.set('on');

    if (!this.listening) {
      this.listening = true;
      messagingSdk.onMessage(messaging, payload =>
        this.foreground.next({
          title: payload.notification?.title,
          body: payload.notification?.body,
          data: payload.data
        })
      );
    }
  }

  private storedToken(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  private storeToken(token: string): void {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
  }

  private forgetToken(): void {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  }
}
