import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const tokens = inject(TokenService);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 is terminal — there is no refresh-token flow to fall back on, and
      // it now also means an admin blocked this account and revoked its
      // tokens. Either way the only correct response is to end the session.
      if (err.status === 401) {
        tokens.clearToken();
        auth.clearUser();
        if (!router.url.startsWith('/login')) {
          // An admin token now expires after 12 hours, so a 401 is routine
          // rather than exceptional. Carrying the current URL means signing in
          // again returns to the screen that was open instead of the dashboard
          // home. No toast: the login screen is the message.
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      return throwError(() => err);
    })
  );
};
