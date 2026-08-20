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
  // Public marketing page — deliberately outside the dashboard shell, so it
  // carries no guard, no navbar and no sidebar.
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component/landing.component').then(m => m.LandingComponent)
  },
  // The page lived at `/landing` before it moved to the root; keep old links
  // and bookmarks working instead of dropping them on the wildcard.
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
