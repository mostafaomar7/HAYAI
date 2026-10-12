import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';

export type AuthMode = 'bearer' | 'cookie';

/** Set at login, rotated on refresh, expired on logout — and readable by JS. */
const XSRF_COOKIE = 'XSRF-TOKEN';

/**
 * Which kind of session this build is running, and whether one is present.
 *
 * Two modes exist because the move off `localStorage` (BUG-02) is a change on
 * both sides at once, and the API's half ships first. `bearer` is what runs
 * today. `cookie` is only correct once the API is setting `hayai_auth`, so the
 * default stays `bearer` and the switch is a server setting rather than a
 * rebuild — if the flip goes wrong, a Supervisor line and a restart put every
 * admin back, instead of a build and a redeploy.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tokens = inject(TokenService);

  private cachedMode: AuthMode | null = null;

  /**
   * `AUTH_MODE` from the server, printed into the shell as a meta tag, with
   * the build's own default behind it. A meta tag rather than a JSON island
   * so the enforced CSP on these pages has nothing to say about it.
   */
  mode(): AuthMode {
    if (this.cachedMode) return this.cachedMode;
    let mode = (environment.authMode ?? 'bearer') as AuthMode;
    if (this.isBrowser) {
      const meta = this.document
        .querySelector('meta[name="hayai-auth-mode"]')
        ?.getAttribute('content');
      if (meta === 'cookie' || meta === 'bearer') mode = meta;
    }
    this.cachedMode = mode;
    if (mode === 'cookie') this.forgetStoredToken();
    return mode;
  }

  get isCookieMode(): boolean {
    return this.mode() === 'cookie';
  }

  /**
   * Is there a session to try, as far as this page can tell?
   *
   * In cookie mode the session itself is invisible here — that is the whole
   * point of it — so the readable `XSRF-TOKEN` stands in. It is set and
   * expired alongside `hayai_auth`, so its presence is the same answer.
   *
   * It is a hint for routing, never a decision: the guard still asks
   * `/auth/me`, and nothing a page can read grants access to anything.
   */
  hasSession(): boolean {
    return this.isCookieMode ? this.readCookie(XSRF_COOKIE) !== null : this.tokens.hasToken();
  }

  /** The value to echo back on a write. Read at call time — refresh rotates it. */
  xsrfToken(): string | null {
    return this.readCookie(XSRF_COOKIE);
  }

  /**
   * Ends what this side can end. In cookie mode `hayai_auth` is HttpOnly and
   * belongs to the API's host, so only the API can expire it — which it does,
   * on logout and on a 401.
   */
  clear(): void {
    if (!this.isCookieMode) this.tokens.clearToken();
  }

  /** A token left over from before the switch is dead weight and a liability. */
  private forgetStoredToken(): void {
    if (this.isBrowser) this.tokens.clearToken();
  }

  /**
   * Plain splitting rather than a built regex: the name goes in from this
   * file only, and a cookie value is allowed to contain characters that would
   * need escaping on the way into a pattern.
   */
  private readCookie(name: string): string | null {
    if (!this.isBrowser) return null;
    try {
      for (const part of this.document.cookie.split(';')) {
        const entry = part.trim();
        if (entry.startsWith(name + '=')) {
          return decodeURIComponent(entry.slice(name.length + 1));
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}
