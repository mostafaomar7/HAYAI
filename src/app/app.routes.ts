import { Routes } from '@angular/router';
import { dashboardShellGuard } from './core/guards/auth.guard';
import { roleMatchGuard } from './core/guards/role-match.guard';
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
    // canActivate: [dashboardShellGuard],
    children: [
      {
        path: 'dashboard',
        // canMatch: [roleMatchGuard(['manager'])],
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
//   {
    //     path: 'daily-visits',
    //     canMatch: [roleMatchGuard(['manager'])],
    //     loadChildren: () =>
    //       import('./features/daily-visits/daily-visits.routes').then(m => m.DAILY_VISITS_ROUTES)
    //   },
    //   {
    //     path: 'reports',
    //     canMatch: [roleMatchGuard(['admin', 'manager'])],
    //     loadChildren: () =>
    //       import('./features/reports/reports.routes').then(m => m.REPORTS_ROUTES)
    //   },
    //   {
    //     path: 'users',
    //     canMatch: [roleMatchGuard(['admin'])],
    //     loadChildren: () =>
    //       import('./features/users/users.routes').then(m => m.USERS_ROUTES)
    //   },
    //   {
    //     path: 'branches',
    //     canMatch: [roleMatchGuard(['admin'])],
    //     loadChildren: () =>
    //       import('./features/branches/branches.routes').then(m => m.BRANCHES_ROUTES)
    //   }