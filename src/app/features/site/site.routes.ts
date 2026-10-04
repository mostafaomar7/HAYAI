import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { SiteShellComponent } from './shell/site-shell.component';
import { siteDataResolver, siteViewResolver, previewResolver } from './site.resolvers';
import { TRACK_ORDER_SEGMENTS } from './site-paths';

/**
 * The whole URL this route was reached by, including the `:locale` segment
 * that belongs to the parent, plus the query.
 *
 * `ActivatedRouteSnapshot.url` holds only the segments this route matched, and
 * the wildcard below matches nothing on `/en` and `/ar` alike — so comparing
 * it cannot tell the two apart. Walking `pathFromRoot` can.
 */
function fullPath(s: ActivatedRouteSnapshot): string {
  const path = s.pathFromRoot
    .flatMap(r => r.url.map(seg => seg.path))
    .join('/');
  const query = new URLSearchParams(
    Object.entries(s.queryParams).map(([k, v]) => [k, String(v)])
  );
  query.sort();
  return `${path}?${query.toString()}`;
}

/**
 * Children of `/:locale`. Apart from the guest order-tracking page, every
 * path — `/en`, `/en/hospitals/partner-with-hayai`, `/ar/products/...` — is
 * one catch-all whose resolver asks the CMS what the path is. New CMS pages
 * therefore never need a deploy.
 */
export const SITE_ROUTES: Routes = [
  {
    path: '',
    component: SiteShellComponent,
    resolve: { site: siteDataResolver },
    children: [
      {
        path: TRACK_ORDER_SEGMENTS.join('/'),
        loadComponent: () => import('./pages/track-order-page.component').then(m => m.TrackOrderPageComponent)
      },
      {
        path: '**',
        loadComponent: () => import('./pages/site-view.component').then(m => m.SiteViewComponent),
        resolve: { view: siteViewResolver },
        // A wildcard route has no params of its own, so neither the default
        // ("params changed") nor `pathParamsOrQueryParamsChange` re-runs the
        // resolver here: between `/en` and `/ar` the segments this route
        // matched are empty both times, and the locale lives on the parent.
        // That left the language link changing the URL and the chrome while
        // the page content, `<html lang>` and `dir` stayed on the old
        // language until a manual refresh. Comparing the full path instead
        // catches a locale switch, a different CMS page and `?page=2`, while
        // still not re-fetching for a `#fragment` jump.
        runGuardsAndResolvers: (from, to) => fullPath(from) !== fullPath(to)
      }
    ]
  }
];

/** `/preview?token=…&locale=…` (top level, outside `/:locale`). */
export const PREVIEW_ROUTES: Routes = [
  {
    path: '',
    component: SiteShellComponent,
    resolve: { site: siteDataResolver },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/site-view.component').then(m => m.SiteViewComponent),
        resolve: { view: previewResolver },
        runGuardsAndResolvers: 'always'
      }
    ]
  }
];
