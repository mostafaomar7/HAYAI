import { DOCUMENT, Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { apiUrl } from './site-api.service';
import { SiteStateService } from './site-state.service';
import { Dict } from '../models/site.models';
import { uuid } from '../site-utils';

const SESSION_KEY = 'hayai_site_session';
const ATTR_KEY = 'hayai_site_attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/**
 * Visitor attribution + analytics events. Browser-only by construction: every
 * public method is a no-op on the server, so a server render can never emit an
 * event (it would count every crawler fetch as a visit) or touch storage.
 *
 * Conversions (`contact_submitted`, `purchase_submitted`, …) are recorded by
 * the API when the submission arrives (contract §14), so the client only sends
 * the funnel events leading up to them — sending them too would double count.
 */
@Injectable({ providedIn: 'root' })
export class SiteAnalyticsService {
  private state = inject(SiteStateService);
  private document = inject(DOCUMENT);
  private zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private queue: Dict[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private memorySession: string | null = null;

  /** Session id shared by events and form/purchase attribution. */
  sessionId(): string {
    if (!this.isBrowser) return '';
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uuid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return (this.memorySession ??= uuid());
    }
  }

  /**
   * Remembers how the visitor arrived: the first landing page and referrer of
   * the session, and the latest utm_* set (a new campaign click mid-session
   * should win). Called on every navigation; cheap when nothing changed.
   */
  captureLanding(): void {
    if (!this.isBrowser) return;
    try {
      const params = new URLSearchParams(location.search);
      const stored: Dict = JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null') ?? {};
      let changed = false;
      if (!stored['landing_page']) {
        stored['landing_page'] = location.pathname + location.search;
        stored['referrer'] = this.document.referrer || null;
        changed = true;
      }
      if (UTM_KEYS.some(k => params.has(k))) {
        UTM_KEYS.forEach(k => (stored[k] = params.get(k) || null));
        changed = true;
      }
      if (changed) sessionStorage.setItem(ATTR_KEY, JSON.stringify(stored));
    } catch {
      /* storage blocked: attribution is best-effort */
    }
  }

  /** The `attribution` object forms and purchases send (contract §18.3). */
  attribution(extra: Dict = {}): Dict {
    if (!this.isBrowser) return {};
    let stored: Dict = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null') ?? {};
    } catch {}
    const out: Dict = { session_id: this.sessionId() };
    UTM_KEYS.forEach(k => stored[k] && (out[k] = stored[k]));
    out['landing_page'] = stored['landing_page'] ?? location.pathname + location.search;
    if (stored['referrer']) out['referrer'] = stored['referrer'];
    const pageId = this.state.page()?.id;
    if (pageId) out['page_id'] = pageId;
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') out[k] = v;
    return out;
  }

  track(event: string, extra: Dict = {}): void {
    if (!this.isBrowser) return;
    const cfg = this.state.site()?.analytics;
    if (!cfg?.enabled) return;
    if (Array.isArray(cfg.events) && cfg.events.length && !cfg.events.includes(event)) return;

    let utm: Dict = {};
    try {
      utm = JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null') ?? {};
    } catch {}
    const row: Dict = { event, session_id: this.sessionId(), path: location.pathname, locale: this.state.locale() };
    UTM_KEYS.forEach(k => utm[k] && (row[k] = utm[k]));
    const pageId = this.state.page()?.id;
    if (pageId) row['page_id'] = pageId;
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== '') row[k] = v;

    this.queue.push(row);
    this.listen();
    if (this.queue.length >= 25) this.flush(false);
    // Outside the zone: a pending analytics timer must not keep the app
    // "unstable" (that would delay hydration clean-up and change detection).
    else if (!this.timer) this.timer = this.zone.runOutsideAngular(() => setTimeout(() => this.flush(false), 4000));
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    // `pagehide` / hidden is the last reliable moment on mobile (no `unload`).
    const onHide = () => this.flush(true);
    addEventListener('pagehide', onHide);
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'hidden') onHide();
    });
  }

  private flush(leaving: boolean): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const endpoint = apiUrl(this.state.site()?.analytics?.endpoint || '/api/v1/public/events');
    while (this.queue.length) {
      const body = JSON.stringify({ events: this.queue.splice(0, 25) });
      let sent = false;
      if (leaving && typeof navigator.sendBeacon === 'function') {
        try {
          sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        } catch {
          sent = false;
        }
      }
      if (!sent) {
        fetch(endpoint, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body
        }).catch(() => {});
      }
    }
  }
}
