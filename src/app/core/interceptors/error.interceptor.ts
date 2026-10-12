import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

/**
 * Marks a request this interceptor has already retried after a CSRF
 * mismatch. A context token rather than a header, so nothing extra is sent
 * to the API.
 */
const CSRF_RETRIED = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const session = inject(SessionService);
  const auth = inject(AuthService);

  const handle = (request: HttpRequest<unknown>, forward: HttpHandlerFn): Observable<HttpEvent<unknown>> =>
    forward(request).pipe(
      catchError((err: HttpErrorResponse) => {
        // 401 is terminal — there is no refresh-token flow to fall back on, and
        // it now also means an admin blocked this account and revoked its
        // tokens. Either way the only correct response is to end the session.
        //
        // In cookie mode there is nothing to clear here: `hayai_auth` is
        // HttpOnly and belongs to the API's host, and the API expires it
        // itself on a 401. Clearing the user is still ours to do.
        if (err.status === 401) {
          session.clear();
          auth.clearUser();
          if (!router.url.startsWith('/login')) {
            // An admin token now expires after 12 hours, so a 401 is routine
            // rather than exceptional. Carrying the current URL means signing in
            // again returns to the screen that was open instead of the dashboard
            // home. No toast: the login screen is the message.
            router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          }
        }

        // 419 is a CSRF mismatch, which is not a session ending and must never
        // sign anybody out. It happens when a refresh rotated `XSRF-TOKEN`
        // between this request being built and being sent, so reading the
        // cookie again and going once more is usually the whole fix. Once
        // only — a second failure is a real problem and belongs on screen,
        // with the admin still signed in.
        if (
          err.status === 419 &&
          session.isCookieMode &&
          !request.context.get(CSRF_RETRIED)
        ) {
          const xsrf = session.xsrfToken();
          if (xsrf) {
            request.context.set(CSRF_RETRIED, true);
            return handle(
              request.clone({ headers: request.headers.set('X-XSRF-TOKEN', xsrf) }),
              forward
            );
          }
        }

        return throwError(() => err);
      })
    );

  return handle(req, next);
};
