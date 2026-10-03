import { Routes } from '@angular/router';
import { SiteShellComponent } from './shell/site-shell.component';
import { siteDataResolver, siteViewResolver, previewResolver } from './site.resolvers';
import { TRACK_ORDER_SEGMENTS } from './site-paths';

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
        // A wildcard route has no params, so the default ("params changed")
        // would never re-run the resolver between two CMS pages. Path or
        // query changes must (?page=2 is a different listing page).
        runGuardsAndResolvers: 'pathParamsOrQueryParamsChange'
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
