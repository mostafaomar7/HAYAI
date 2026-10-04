/**
 * SERVER-ONLY. Imported from `app.config.server.ts` and nowhere else, so none
 * of this (nor the website key) can reach the browser bundle.
 *
 * Why an `HttpBackend` and not an interceptor: Angular's HTTP transfer cache is
 * itself the LAST interceptor in the chain. Anything that short-circuits or
 * rewrites the URL earlier would hide the response from it (the browser would
 * then refetch everything the server already fetched) or store it under the
 * internal API URL (which the browser never asks for). Sitting below every
 * interceptor, this backend keeps the transfer-state key equal to the URL the
 * browser will request, while the actual network call can go elsewhere.
 */
import { Injectable, inject } from '@angular/core';
import { FetchBackend, HttpBackend, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

const BROWSER_API_BASE = environment.apiBaseUrl.replace(/\/+$/, '');
// The API the Node server talks to. May be an internal address of the same
// Laravel app (faster, no public TLS hop); the public path layout must match.
const SERVER_API_BASE = (process.env['API_BASE_URL'] || BROWSER_API_BASE).replace(/\/+$/, '');
// Sent on every server-side call so the API does not rate-limit the whole
// website as one IP. Never put in a template, a transfer-state entry or a
// browser request.
const WEBSITE_KEY = process.env['WEBSITE_SERVER_KEY'] || '';

const PUBLIC_PREFIX = `${BROWSER_API_BASE}/public/`;

/**
 * Tiny in-process cache for public GETs. TTFB budget: the site shell (`/site`,
 * menus + organisation) is identical for every page of a locale, and crawlers
 * hammer the same URLs. The API already says `max-age=60`, so serving a copy
 * that is up to a minute old adds no staleness editors would not see anyway.
 */
const MAX_ENTRIES = 500;
const cache = new Map<string, { expires: number; response: HttpResponse<unknown> }>();

function ttlFor(req: HttpRequest<unknown>): number {
  if (req.method !== 'GET') return 0;
  const path = req.urlWithParams.slice(PUBLIC_PREFIX.length);
  // Previews are drafts and purchase look-ups carry a private token: never cache.
  if (/^(preview|purchases|me)\//.test(path)) return 0;
  if (/^(en|ar)\/site(\?|$)/.test(path)) return 60_000;
  return 30_000;
}

@Injectable()
export class SiteServerBackend implements HttpBackend {
  private readonly fetchBackend = inject(FetchBackend);

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith(PUBLIC_PREFIX)) return this.fetchBackend.handle(req);

    let headers = req.headers.delete('Authorization');
    if (WEBSITE_KEY) headers = headers.set('X-Website-Key', WEBSITE_KEY);
    const outgoing = req.clone({ url: SERVER_API_BASE + req.url.slice(BROWSER_API_BASE.length), headers });

    const ttl = ttlFor(req);
    if (!ttl) return this.fetchBackend.handle(outgoing);

    const key = outgoing.urlWithParams;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return of(hit.response.clone());

    return this.fetchBackend.handle(outgoing).pipe(
      tap(event => {
        if (event instanceof HttpResponse && event.status === 200) {
          if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
          cache.set(key, { expires: Date.now() + ttl, response: event });
        }
      })
    );
  }
}
