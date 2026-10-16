import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminAccessService } from '../services/admin-access.service';

/** Where an admin with a temporary password is held until they replace it. */
export const CHANGE_PASSWORD_URL = '/dashboard/change-password';

/**
 * Runs on every dashboard screen, after `dashboardShellGuard` has resolved
 * the session.
 *
 * - An admin signed in with a temporary password (`must_change_password`)
 *   goes to change-password, and nowhere else, until it is done.
 * - A screen whose area the admin cannot view lands on `/dashboard/no-access`
 *   instead of opening and failing on every request. The area table is in
 *   AdminAccessService.
 */
export const adminAreaGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const access = inject(AdminAccessService);
  const router = inject(Router);
  const url = state.url;

  if (auth.currentUser()?.must_change_password) {
    return url.split(/[?#]/)[0] === CHANGE_PASSWORD_URL ? true : router.createUrlTree([CHANGE_PASSWORD_URL]);
  }
  if (access.canOpen(url)) return true;
  return router.createUrlTree(['/dashboard/no-access'], { queryParams: { from: url } });
};
