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
  const allow = (user: UserModel | null) =>
    user?.user_type === 'admin' ? true : router.createUrlTree(['/login']);

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
