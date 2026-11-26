import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, of, shareReplay } from 'rxjs';
import { Dict } from '../models/site.models';
import { SiteLocale } from '../site-paths';
import { SiteApiService } from './site-api.service';

const SESSION_KEY = 'hayai_web_session';
const TOKENS_KEY = 'hayai_request_tokens';
const DRAFT_PREFIX = 'hayai_form_draft:';
/** A draft older than this is a different visit: start clean. */
const DRAFT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MAX_REMEMBERED_REQUESTS = 20;

/** The verified website session (website-only: it cannot open the app API). */
export interface WebSession {
  token: string;
  expires_at: string | null;
  phone_masked: string | null;
  /** From the verify response; unknown for a session checked later. */
  has_password?: boolean | null;
}

export interface PolicyVersions {
  terms: string;
  privacy: string;
  termsUrl: string | null;
  privacyUrl: string | null;
}

export interface FormDraft {
  values: Record<string, string | string[] | boolean>;
  /** The Idempotency-Key of an attempt whose answer never arrived. */
  attempt?: string | null;
  saved_at: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: the flow still works, it just forgets */
  }
}

/**
 * The visitor's side of "every website request becomes a HAYAI patient"
 * (backend brief 2026-11-26): the verified session, the policy versions a
 * verification accepts, form drafts and the request links already received.
 *
 * Everything here is browser-only. On the server every method is inert, so a
 * server render never reads storage or calls the session endpoint.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteAccountService {
  private api = inject(SiteApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Set once the stored session has been confirmed by the API. */
  readonly session = signal<WebSession | null>(null);
  private checked: Observable<WebSession | null> | null = null;
  private policies: Observable<PolicyVersions | null> | null = null;

  /** The stored token, for the submit header, before or without the check. */
  storedToken(): string | null {
    if (!this.isBrowser) return null;
    const s = read<WebSession>(SESSION_KEY);
    if (!s?.token) return null;
    if (s.expires_at && Date.parse(s.expires_at) < Date.now()) {
      write(SESSION_KEY, null);
      return null;
    }
    return s.token;
  }

  /**
   * Confirms the stored session once per page load. `verified: false` clears
   * it. A network failure keeps it: the submission is checked again by the API
   * anyway, and a lost connection must not sign anybody out.
   */
  check(locale: SiteLocale): Observable<WebSession | null> {
    if (!this.isBrowser) return of(null);
    const token = this.storedToken();
    if (!token) {
      this.session.set(null);
      return of(null);
    }
    this.checked ??= new Observable<WebSession | null>(sub => {
      const stored = read<WebSession>(SESSION_KEY)!;
      const s = this.api.accountSession(locale, token).subscribe({
        next: d => {
          if (d?.['verified']) {
            const next: WebSession = {
              ...stored,
              phone_masked: (d['phone_masked'] as string) || stored.phone_masked,
              expires_at: (d['expires_at'] as string) || stored.expires_at
            };
            write(SESSION_KEY, next);
            this.session.set(next);
            sub.next(next);
          } else {
            this.clear();
            sub.next(null);
          }
          sub.complete();
        },
        error: () => {
          this.session.set(stored);
          sub.next(stored);
          sub.complete();
        }
      });
      return () => s.unsubscribe();
    }).pipe(shareReplay(1));
    return this.checked;
  }

  /** After a successful verify. */
  remember(verify: Dict): WebSession | null {
    const s = verify?.['session'] as Dict | undefined;
    const token = typeof s?.['token'] === 'string' ? (s['token'] as string) : '';
    if (!token) return null;
    const account = (verify['account'] ?? {}) as Dict;
    const next: WebSession = {
      token,
      expires_at: (s!['expires_at'] as string) ?? null,
      phone_masked: (account['phone_masked'] as string) ?? null,
      has_password: typeof account['has_password'] === 'boolean' ? (account['has_password'] as boolean) : null
    };
    write(SESSION_KEY, next);
    this.session.set(next);
    this.checked = of(next);
    return next;
  }

  /** "Not you?": ends the session on the API too (best-effort) and forgets it. */
  forget(locale: SiteLocale): void {
    const token = this.storedToken();
    this.clear();
    if (token) this.api.endAccountSession(locale, token).subscribe({ error: () => {} });
  }

  private clear(): void {
    write(SESSION_KEY, null);
    this.session.set(null);
    this.checked = null;
  }

  /** Policy versions from `/about`, fetched once; `refresh` after a version 422. */
  policyVersions(refresh = false): Observable<PolicyVersions | null> {
    if (refresh) this.policies = null;
    this.policies ??= this.api.about().pipe(
      map(d =>
        d && d['application_policy_version'] && d['privacy_policy_version']
          ? {
              terms: String(d['application_policy_version']),
              privacy: String(d['privacy_policy_version']),
              termsUrl: (d['terms_url'] as string) || null,
              privacyUrl: (d['privacy_url'] as string) || null
            }
          : null
      ),
      shareReplay(1)
    );
    return this.policies;
  }

  // ---- request links: `{reference: token}`, so "my requests" links work later

  rememberRequest(reference: string, token: string): void {
    if (!this.isBrowser || !reference || !token) return;
    const all = read<Record<string, string>>(TOKENS_KEY) ?? {};
    delete all[reference];
    all[reference] = token;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_REMEMBERED_REQUESTS))) delete all[k];
    write(TOKENS_KEY, all);
  }

  requestToken(reference: string): string | null {
    if (!this.isBrowser) return null;
    return read<Record<string, string>>(TOKENS_KEY)?.[reference] ?? null;
  }

  // ---- form drafts (per form key): survive refresh, the code step, a lost connection

  draft(formKey: string): FormDraft | null {
    if (!this.isBrowser) return null;
    const d = read<FormDraft>(DRAFT_PREFIX + formKey);
    if (!d || !d.values || Date.now() - (d.saved_at || 0) > DRAFT_MAX_AGE_MS) return null;
    return d;
  }

  saveDraft(formKey: string, values: FormDraft['values'], attempt: string | null): void {
    if (!this.isBrowser) return;
    const filled = Object.values(values).some(v => (Array.isArray(v) ? v.length : v !== '' && v !== false));
    write(DRAFT_PREFIX + formKey, filled || attempt ? { values, attempt, saved_at: Date.now() } : null);
  }

  clearDraft(formKey: string): void {
    if (this.isBrowser) write(DRAFT_PREFIX + formKey, null);
  }
}
