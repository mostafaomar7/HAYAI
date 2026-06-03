import { Routes } from '@angular/router';
import { dashboardShellGuard } from './core/guards/auth.guard';
import { DashboardShellComponent } from './core/layouts/dashboard-shell/dashboard-shell.component/dashboard-shell.component';

export const routes: Routes = [
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
