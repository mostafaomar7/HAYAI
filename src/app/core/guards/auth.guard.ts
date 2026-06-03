import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

export const dashboardShellGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  const router = inject(Router);

  if (auth.currentUser()) return true;

  if (!tokens.hasToken()) return router.createUrlTree(['/login']);

  return auth.me().pipe(
    map(() => true),
    catchError(() => {
      tokens.clearToken();
      return of(router.createUrlTree(['/login']));
    })
  );
};
