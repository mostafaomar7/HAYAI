import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function roleMatchGuard(allowedRoles: string[]): CanMatchFn {
  return (route: Route, segments: UrlSegment[]) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.currentUser();
    const role = user?.role;

    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/login']);
  };
}