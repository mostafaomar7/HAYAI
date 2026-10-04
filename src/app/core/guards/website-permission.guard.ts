import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { WebsiteContextService } from '../services/website/website-context.service';

/**
 * Gates a Website CMS screen on the permission in its route `data.permission`.
 *
 * Every existing admin was made `super-admin` at deploy time, but an admin
 * created later has no website access until given a role — without this guard
 * they would open a screen whose every request 403s. Refused navigations land
 * on the Website overview, which itself needs only `cms.view`; an admin
 * without even that is sent back to the main dashboard.
 */
export const websitePermissionGuard: CanActivateFn = route => {
  const ctx = inject(WebsiteContextService);
  const router = inject(Router);
  const permission = route.data?.['permission'] as string | undefined;

  return ctx.allows(permission).pipe(
    map(ok => {
      if (ok) return true;
      return ctx.can('cms.view') && permission !== 'cms.view'
        ? router.createUrlTree(['/dashboard/website'])
        : router.createUrlTree(['/dashboard']);
    })
  );
};
