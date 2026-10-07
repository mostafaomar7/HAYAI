import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { UserModel } from '../models/user.model';

export const dashboardShellGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  const router = inject(Router);

  // Every `/admin/*` endpoint is gated on `user_type === 'admin'` by the
  // backend, so a non-admin session would render a dashboard where each
  // request 403s. Keep them out of the shell entirely.
  //
  // The token is cleared on the way out, not just the route refused. This app
  // is the dashboard and nothing else, so a session that cannot open it is of
  // no use — and `signedOutOnlyGuard` below sends anyone holding a token to
  // `/dashboard`, which would bounce such a session between the two forever.
  const allow = (user: UserModel | null) => {
    if (user?.user_type === 'admin') return true;
    tokens.clearToken();
    return router.createUrlTree(['/login']);
  };

  const current = auth.currentUser();
  if (current) return allow(current);

  if (!tokens.hasToken()) return router.createUrlTree(['/login']);

  return auth.me().pipe(
    map(user => allow(user)),
    catchError(() => {
      tokens.clearToken();
      return of(router.createUrlTree(['/login']));
    })
  );
};

/**
 * The pages that only make sense signed out: the login form and the parked
 * holding page at `/`.
 *
 * Without this, an admin who is already signed in can open `/login` and be
 * shown a form for a session they already have — and, worse, be handed back to
 * `/` afterwards, which renders the "coming soon" holding page. That reads as
 * a logout, or as the site being down.
 *
 * The check is the stored token, not `currentUser()`, for the same reason the
 * wildcard route uses it: on a cold page load the session is not resolved yet,
 * so the signal is still null for an admin who is very much signed in. A stale
 * or non-admin token routes to `/dashboard`, where the shell guard validates
 * it, clears it and sends it to `/login` — one bounce, not a loop.
 */
export const signedOutOnlyGuard: CanActivateFn = () => {
  const tokens = inject(TokenService);
  const router = inject(Router);
  return tokens.hasToken() ? router.createUrlTree(['/dashboard']) : true;
};
