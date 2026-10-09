import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SiteStateService } from './site-state.service';
import { SiteAnalyticsService } from './site-analytics.service';
import { apiUrl } from './site-api.service';

/** No 0/O/1/I/L: an agent reads the code off a phone screen and types it. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const STORAGE_KEY = 'hayai_wa_ref';
const WHATSAPP_LINK = /^(https?:\/\/(wa\.me|api\.whatsapp\.com)\/|whatsapp:\/\/)/i;

/**
 * A reference code on every WhatsApp chat that starts on the website, so the
 * chat can be traced back to the campaign that brought the visitor
 * (measurement spec §8; API §7.2).
 *
 * On a tap on any WhatsApp link — a CMS button or the footer number — and
 * inside the click itself:
 *
 *  1. a code like `H-7K3Q9MX` is made in the browser (one per visit),
 *  2. it is appended to the link's pre-filled message,
 *  3. the API is told code → attribution with a beacon,
 *  4. the click goes on, untouched otherwise.
 *
 * Nothing waits for the network. The link must open within the tap: an
 * awaited request first gets the new window blocked on mobile Safari and
 * delays the exact interaction that converts. A beacon cannot delay the
 * navigation, and the API stores the code whether or not this page is still
 * open when it arrives.
 *
 * The link stays a real link, so the tag manager's WhatsApp click trigger and
 * its conversion still see it exactly as before.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappRefService {
  private state = inject(SiteStateService);
  private analytics = inject(SiteAnalyticsService);
  private document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private installed = false;
  private sentRef: string | null = null;
  private memoryRef: string | null = null;

  /** Once, from the shell. Capture phase: runs before the tag manager reads the URL. */
  install(): void {
    if (!this.isBrowser || this.installed) return;
    this.installed = true;
    this.document.addEventListener('click', e => this.onClick(e), true);
    // Middle-click / ctrl-click open the chat too.
    this.document.addEventListener('auxclick', e => this.onClick(e), true);
  }

  private onClick(event: Event): void {
    const target = event.target as Element | null;
    const link = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || !WHATSAPP_LINK.test(link.getAttribute('href') ?? '')) return;
    try {
      const ref = this.ref();
      const href = withRef(link.href, ref, this.label());
      if (href !== link.href) link.setAttribute('href', href);
      this.report(ref, link);
    } catch {
      /* a code is a bonus; never stand between the visitor and the chat */
    }
  }

  /** One code per visit: a second tap reopens the same conversation. */
  private ref(): string {
    if (this.memoryRef) return this.memoryRef;
    let ref: string | null = null;
    try {
      ref = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked: keep it in memory for this page */
    }
    if (!ref || !/^H-[2-9A-HJKMNP-Z]{7}$/.test(ref)) {
      const bytes = new Uint8Array(7);
      crypto.getRandomValues(bytes);
      ref = 'H-' + Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
      try {
        sessionStorage.setItem(STORAGE_KEY, ref);
      } catch {
        /* see above */
      }
    }
    this.memoryRef = ref;
    return ref;
  }

  private label(): string {
    return this.state.locale() === 'ar' ? 'رقم المرجع' : 'Ref';
  }

  /** Code → attribution, once per code per page. The API is idempotent anyway. */
  private report(ref: string, link: HTMLAnchorElement): void {
    if (this.sentRef === ref) return;
    this.sentRef = ref;
    const ctaKey = link.closest('[data-cta]')?.getAttribute('data-cta') ?? null;
    const body = JSON.stringify({
      ref,
      page_path: location.pathname + location.search,
      cta_tracking_key: ctaKey,
      attribution: this.analytics.attribution({ cta_tracking_key: ctaKey })
    });
    const endpoint = apiUrl(`/api/v1/public/${this.state.locale()}/whatsapp-refs`);
    // text/plain: a JSON content type would need a CORS preflight, which a
    // beacon does not wait for. The API parses the body as JSON either way.
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) return;
    fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
  }
}

/**
 * The link with the code at the end of its pre-filled message. A link with no
 * message gets the code alone. Already carrying this code: unchanged.
 */
export function withRef(href: string, ref: string, label: string): string {
  const url = new URL(href);
  const text = url.searchParams.get('text') ?? '';
  if (text.includes(ref)) return href;
  url.searchParams.set('text', (text ? `${text}\n\n` : '') + `${label}: ${ref}`);
  // URLSearchParams writes spaces as "+", which WhatsApp shows literally in
  // the message on some clients. %20 is read as a space everywhere.
  url.search = url.search.replace(/\+/g, '%20');
  return url.toString();
}
