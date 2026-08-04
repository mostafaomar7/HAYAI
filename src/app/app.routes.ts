import { Routes } from '@angular/router';
import { dashboardShellGuard } from './core/guards/auth.guard';
import { DashboardShellComponent } from './core/layouts/dashboard-shell/dashboard-shell.component/dashboard-shell.component';

export const routes: Routes = [
  // Public marketing page — deliberately outside the dashboard shell, so it
  // carries no guard, no navbar and no sidebar.
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/landing.component/landing.component').then(m => m.LandingComponent)
  },
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
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
