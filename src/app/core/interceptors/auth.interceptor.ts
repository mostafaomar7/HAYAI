import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';
import { TokenService } from '../services/token.service';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Anonymous endpoints: everything the public website reads.
 *
 * These are deliberately **not** sent with credentials, which is the one place
 * this departs from the backend's note ("withCredentials on every call to the
 * API"). Measured on 2026-10-12: the API answers these with
 * `Access-Control-Allow-Origin: *` and no `Access-Control-Allow-Credentials`,
 * and a browser refuses a credentialed cross-origin response carrying a
 * wildcard origin. Sending credentials here would not tighten anything — there
 * is no session to send — and it would take the public website down the moment
 * cookie mode was switched on.
 */
function isAnonymous(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith(`${environment.apiBaseUrl}/public/`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const accept = req.headers.has('Accept')
    ? req.headers
    : req.headers.set('Accept', 'application/json');

  if (!session.isCookieMode) {
    const token = inject(TokenService).getToken();
    const headers = token ? accept.set('Authorization', `Bearer ${token}`) : accept;
    return next(req.clone({ headers }));
  }

  // Cookie mode. The API takes either the cookie or a bearer header and
  // prefers the header, so one stale `Authorization` would quietly put the
  // session back where it was. Remove it rather than trust that none is set.
  let headers = accept.delete('Authorization');

  if (!req.url.startsWith(environment.apiBaseUrl) || isAnonymous(req)) {
    return next(req.clone({ headers }));
  }

  if (!SAFE_METHODS.includes(req.method.toUpperCase())) {
    const xsrf = session.xsrfToken();
    if (xsrf) headers = headers.set('X-XSRF-TOKEN', xsrf);
  }

  // Angular's own XSRF support cannot be used here: it skips absolute URLs,
  // and the API is on another host, so every one of these is absolute.
  return next(req.clone({ headers, withCredentials: true }));
};
