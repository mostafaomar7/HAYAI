import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { dashboardShellGuard } from './core/guards/auth.guard';
import { TokenService } from './core/services/token.service';
import { DashboardShellComponent } from './core/layouts/dashboard-shell/dashboard-shell.component/dashboard-shell.component';

/**
 * Route order matters here. The domain root is the public marketing page, and
 * the dashboard shell also sits on an empty path so that `/dashboard` keeps its
 * URL. Both can coexist because the landing entry is `pathMatch: 'full'`: it
 * only claims the exact empty URL, while the shell prefix-matches and lets its
 * children take the rest. Anything that matches neither falls through to the
 * wildcard.
 */
export const routes: Routes = [
  // Public holding page — deliberately outside the dashboard shell, so it
  // carries no guard, no navbar and no sidebar.
  //
  // ---------------------------------------------------------------------
  // The marketing site is finished and lives at
  // `features/landing/landing.component/` — it is parked, not deleted. To put
  // it back, swap the `loadComponent` below for the commented line and delete
  // the coming-soon import.
  //
  // It is unrouted rather than hidden on purpose. Covering it with an overlay
  // would still send the whole page to every visitor, and one `display: none`
  // in devtools would expose it. With no route referencing it, the lazy chunk
  // is never even built, so there is nothing in the browser to reveal.
  // ---------------------------------------------------------------------
  {
    path: '',
    pathMatch: 'full',
    // import('./features/landing/landing.component/landing.component').then(m => m.LandingComponent)
    loadComponent: () =>
      import('./features/coming-soon/coming-soon.component/coming-soon.component')
        .then(m => m.ComingSoonComponent)
  },
  // `/landing` was the marketing page's old address. It stays pointed at the
  // root so an old link cannot slip past the holding page.
  { path: 'landing', pathMatch: 'full', redirectTo: '' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: DashboardShellComponent,
    canActivate: [dashboardShellGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      }
    ]
  },
  // Where an unknown URL lands depends on who typed it. A signed-out visitor
  // gets the marketing page; someone with a session gets the dashboard, since
  // dropping an admin on the landing page mid-session reads as a logout.
  //
  // The check is the stored token, not `currentUser()`: on a cold page load the
  // session is not resolved yet, so the signal is still null for an admin who
  // is very much signed in. A stale token routes to `/dashboard`, where the
  // shell guard validates it and sends it on to `/login` — the same path any
  // other expired session takes.
  {
    path: '**',
    redirectTo: () => (inject(TokenService).hasToken() ? '/dashboard' : '/')
  }
];
