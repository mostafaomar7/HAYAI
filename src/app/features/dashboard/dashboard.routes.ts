import { Routes } from '@angular/router';
import { RECORD_LISTS } from '../../core/services/record-lists.service';
import { OPTION_LISTS } from '../../core/services/option-lists.service';

/**
 * `data.title` is the i18n key the navbar shows for the page. It reuses the
 * `menu.*` keys so the heading always reads exactly like the sidebar entry the
 * user clicked, and sub-pages (add / edit / details) carry the title of the
 * section they belong to rather than falling back to a generic one.
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    data: { title: 'menu.dashboard' },
    loadComponent: () =>
      import('./pages/home.component/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'advertisements',
    data: { title: 'menu.advertisements' },
    loadComponent: () =>
      import('./pages/advertisements/advertisements').then(m => m.Advertisements)
  },
  {
    path: 'advertisements/add',
    data: { title: 'menu.advertisements' },
    loadComponent: () =>
      import('./pages/advertisements-details/advertisements-details').then(m => m.AdvertisementsDetails)
  },
  {
    path: 'advertisements/edit/:id',
    data: { title: 'menu.advertisements' },
    loadComponent: () =>
      import('./pages/advertisements-details/advertisements-details').then(m => m.AdvertisementsDetails)
  },
  {
    path: 'charitable',
    data: { title: 'menu.charitable' },
    loadComponent: () => import('./pages/charitable/charitable').then(m => m.Charitable)
  },
  {
    path: 'charitable/add',
    data: { title: 'menu.charitable' },
    loadComponent: () => import('./pages/charitable-add/charitable-add').then(m => m.CharitableAdd)
  },
  {
    path: 'charitable/edit/:id',
    data: { title: 'menu.charitable' },
    loadComponent: () => import('./pages/charitable-add/charitable-add').then(m => m.CharitableAdd) // ممكن تستخدم نفس كومبوننت الـ Add للتعديل
  },
  {
    path: 'charitable/details/:id',
    data: { title: 'menu.charitable' },
    loadComponent: () => import('./pages/charitable-details/charitable-details').then(m => m.CharitableDetails)
  },
  {
    path: 'renewal',
    data: { title: 'menu.renewal' },
    loadComponent: () => import('./pages/renewal/renewal').then(m => m.Renewal)
  },
  {
    path: 'plans',
    data: { title: 'menu.plans' },
    loadComponent: () => import('./pages/plans/plans').then(m => m.Plans)
  },
  {
    path: 'plans/add',
    data: { title: 'menu.plans' },
    loadComponent: () => import('./pages/plans-add/plans-add').then(m => m.PlansAdd)
  },
  {
    path: 'plans/edit/:id',
    data: { title: 'menu.plans' },
    loadComponent: () => import('./pages/plans-add/plans-add').then(m => m.PlansAdd) // ممكن تستخدم نفس كومبوننت الـ Add للتعديل
  },
  {
    path: 'plans/details/:id',
    data: { title: 'menu.plans' },
    loadComponent: () => import('./pages/plans-details/plans-details').then(m => m.PlansDetails)
  },
  {
    path: 'notification',
    data: { title: 'menu.send_notifications' },
    loadComponent: () => import('./pages/notification/notification').then(m => m.Notification)
  },
  // The path was `notfication` for as long as this page has existed, so it is
  // in browser histories and in whatever anyone has pasted to a colleague.
  // Kept as a redirect rather than deleted: without it those links now land on
  // the dashboard's 404 page, which is a worse answer than the typo was.
  // Absolute targets. A relative `redirectTo` is resolved against the segments
  // already matched, so `notfication/history` -> `notification/history` landed
  // on `/dashboard/notfication/notification/history` and then on the 404.
  { path: 'notfication', redirectTo: '/dashboard/notification', pathMatch: 'full' },
  { path: 'notfication/history', redirectTo: '/dashboard/notification/history', pathMatch: 'full' },
  {
    path: 'patient',
    data: { title: 'menu.users.patients' },
    loadComponent: () => import('./pages/users/patients/patients').then(m => m.Patients)
  },
  {
    path: 'tourist',
    data: { title: 'menu.users.tourists' },
    loadComponent: () => import('./pages/users/tourists/tourists').then(m => m.Tourists)
  },
  {
    path: 'hospital',
    data: { title: 'menu.users.hospitals' },
    loadComponent: () => import('./pages/users/hospital/hospital').then(m => m.Hospital)
  },
  {
    path: 'clinics',
    data: { title: 'menu.users.clinics' },
    loadComponent: () => import('./pages/users/clinics/clinics').then(m => m.Clinics)
  },
  {
    path: 'doctor',
    data: { title: 'menu.users.doctors' },
    loadComponent: () => import('./pages/users/doctor/doctor').then(m => m.Doctor)
  },
  {
    path: 'pharmacies',
    data: { title: 'menu.users.pharmacies' },
    loadComponent: () => import('./pages/users/pharmacies/pharmacies').then(m => m.Pharmacies)
  },
  {
    path: 'labs',
    data: { title: 'menu.users.labs' },
    loadComponent: () => import('./pages/users/labs/labs').then(m => m.Labs)
  },
  {
    path: 'issuance',
    data: { title: 'menu.users.issuance' },
    loadComponent: () => import('./pages/users/medical-issuance/medical-issuance').then(m => m.MedicalIssuance)
  },
  {
    path: 'home-care',
    data: { title: 'menu.users.home_care' },
    loadComponent: () => import('./pages/users/home-care/home-care').then(m => m.HomeCare)
  },
  {
    path: 'therapy',
    data: { title: 'menu.users.therapy' },
    loadComponent: () => import('./pages/users/physical-therapy/physical-therapy').then(m => m.PhysicalTherapy)
  },
  {
    path: 'employment',
    data: { title: 'menu.users.employment' },
    loadComponent: () => import('./pages/users/employment-office/employment-office').then(m => m.EmploymentOffice)
  },
  {
    path: 'medical-devices',
    data: { title: 'menu.users.medical_devices' },
    loadComponent: () => import('./pages/users/medical-devices/medical-devices').then(m => m.MedicalDevices)
  },
  {
    path: 'dialysis',
    data: { title: 'menu.centers.dialysis' },
    loadComponent: () => import('./pages/Centers/dialysis/dialysis').then(m => m.Dialysis)
  },
  {
    path: 'dialysis-details/:id',
    data: { title: 'menu.centers.dialysis' },
    loadComponent: () => import('./pages/Centers/dialysis-details/dialysis-details').then(m => m.DialysisDetails)
  },
  {
    path: 'dialysis-add',
    data: { title: 'menu.centers.dialysis' },
    loadComponent: () =>
      import('./pages/Centers/dialysis-add/dialysis-add').then(m => m.DialysisAdd)
  },
  {
    path: 'dialysis/edit/:id',
    data: { title: 'menu.centers.dialysis' },
    loadComponent: () =>
      import('./pages/Centers/dialysis-add/dialysis-add').then(m => m.DialysisAdd)
  },
  {
    path: 'hyperbaric-oxygen',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () => import('./pages/Centers/hyperbaric-oxygen/hyperbaric-oxygen').then(m => m.HyperbaricOxygen)
  },
  {
    path: 'hyperbaric-oxygen-details/:id',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () => import('./pages/Centers/hyperbaric-oxygen-details/hyperbaric-oxygen-details').then(m => m.HyperbaricOxygenDetails)
  },
  {
    path: 'hyperbaric-oxygen-add',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () =>
      import('./pages/Centers/hyperbaric-oxygen-add/hyperbaric-oxygen-add').then(m => m.HyperbaricOxygenAdd)
  },
  {
    path: 'hyperbaric-oxygen/edit/:id',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () =>
      import('./pages/Centers/hyperbaric-oxygen-add/hyperbaric-oxygen-add').then(m => m.HyperbaricOxygenAdd)
  },
  {
    path: 'oncology',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () => import('./pages/Centers/oncology/oncology').then(m => m.Oncology)
  },
  {
    path: 'oncology-details/:id',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () => import('./pages/Centers/oncology-details/oncology-details').then(m => m.OncologyDetails)
  },
  {
    path: 'oncology-add',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () =>
      import('./pages/Centers/oncology-add/oncology-add').then(m => m.OncologyAdd)
  },
  {
    path: 'oncology/edit/:id',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () =>
      import('./pages/Centers/oncology-add/oncology-add').then(m => m.OncologyAdd)
  },
  {
    path: 'account-deletion-requests',
    data: { title: 'deletion_requests.title' },
    loadComponent: () =>
      import('./pages/account-deletion-requests/account-deletion-requests').then(
        m => m.AccountDeletionRequests
      )
  },
  {
    path: 'hospital-verifications',
    data: { title: 'menu.hospital_verifications' },
    loadComponent: () =>
      import('./pages/hospital-verifications/hospital-verifications').then(m => m.HospitalVerifications)
  },
  // The marketplace under "Internal Medical Devices". Its path said `external`
  // because the API calls both device modules `external-devices` — the group-
  // order module alongside it is the one that is actually external, and it is
  // already at `group-orders`. Two near-identical sections where one of them
  // says the opposite of its own heading is a trap, which is what the QA round
  // walked into. The heading was right; the path was the legacy name.
  //
  // `external/*` is kept as a redirect: it is in histories, and a notification
  // sent before today still carries it.
  {
    path: 'internal-devices/devices',
    data: { title: 'menu.external_devices.devices' },
    loadComponent: () =>
      import('./pages/external-devices/external-devices').then(m => m.ExternalDevices)
  },
  {
    path: 'internal-devices/orders/:id',
    data: { title: 'external.orders.order' },
    loadComponent: () =>
      import('./pages/external-order-details/external-order-details').then(m => m.ExternalOrderDetails)
  },
  {
    path: 'internal-devices/orders',
    data: { title: 'menu.external_devices.orders' },
    loadComponent: () =>
      import('./pages/external-orders/external-orders').then(m => m.ExternalOrders)
  },
  { path: 'external/devices', redirectTo: '/dashboard/internal-devices/devices', pathMatch: 'full' },
  { path: 'external/orders', redirectTo: '/dashboard/internal-devices/orders', pathMatch: 'full' },
  { path: 'external/orders/:id', redirectTo: r => `/dashboard/internal-devices/orders/${r.params['id']}`, pathMatch: 'full' },
  // ===================== External device group orders =====================
  // A separate section from `external/*` above: that is the legacy marketplace,
  // which sells a unit and tracks a payment and a shipment. This module does
  // none of those — HAYAI's role ends at connecting users with the importer —
  // so the two are kept apart rather than merged behind one screen.
  //
  // Literal segments come before ':id', otherwise 'devices' would match the
  // detail route and be parsed as a group-order id.
  {
    path: 'group-orders',
    pathMatch: 'full',
    data: { title: 'menu.group_orders.overview' },
    loadComponent: () =>
      import('./pages/group-orders/group-orders-overview').then(m => m.GroupOrdersOverview)
  },
  {
    path: 'group-orders/devices',
    pathMatch: 'full',
    data: { title: 'menu.group_orders.devices' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-devices').then(m => m.GroupOrderDevices)
  },
  {
    path: 'group-orders/devices/new',
    data: { title: 'gorders.add_device' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-device-form').then(m => m.GroupOrderDeviceForm)
  },
  {
    path: 'group-orders/devices/:id/edit',
    data: { title: 'gorders.edit_device' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-device-form').then(m => m.GroupOrderDeviceForm)
  },
  {
    path: 'group-orders/categories',
    data: { title: 'menu.group_orders.categories', kind: 'categories' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-partners').then(m => m.GroupOrderPartners)
  },
  {
    path: 'group-orders/shipping-companies',
    data: { title: 'menu.group_orders.companies', kind: 'shipping-companies' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-partners').then(m => m.GroupOrderPartners)
  },
  {
    path: 'group-orders/:id',
    data: { title: 'menu.group_orders' },
    loadComponent: () =>
      import('./pages/group-orders/group-order-details').then(m => m.GroupOrderDetails)
  },
  {
    path: 'profile',
    data: { title: 'navbar.my_profile' },
    loadComponent: () =>
      import('./pages/profile/profile').then(m => m.Profile)
  },
  {
    path: 'no-access',
    data: { title: 'access.no_access_title' },
    loadComponent: () => import('./pages/no-access/no-access').then(m => m.NoAccess)
  },
  // Admin accounts and roles. Super-admin only — `adminAreaGuard` closes
  // `access/*` to everyone else, as the API does.
  {
    path: 'access/admins',
    data: { title: 'menu.access.admins' },
    loadComponent: () => import('./pages/access/admins/admins').then(m => m.Admins)
  },
  {
    path: 'access/roles',
    data: { title: 'menu.access.roles' },
    loadComponent: () => import('./pages/access/roles/roles').then(m => m.Roles)
  },
  {
    path: 'change-password',
    data: { title: 'navbar.change_password' },
    loadComponent: () =>
      import('./pages/change-password/change-password').then(m => m.ChangePassword)
  },
  {
    // One screen for all 21 record types. `type` is the machine value straight
    // off the timeline row, so a type added to the app later routes here with
    // no change to this file.
    path: 'activity/:type/:id',
    data: { title: 'activity.record.title' },
    loadComponent: () =>
      import('./pages/activity-record/activity-record').then(m => m.ActivityRecordPage)
  },
  {
    path: 'users/:id/activity',
    data: { title: 'activity.title' },
    loadComponent: () =>
      import('./pages/user-activity/user-activity').then(m => m.UserActivity)
  },
  {
    path: 'pharmacies/new',
    data: { title: 'pharm.create_title' },
    loadComponent: () =>
      import('./pages/pharmacy-manage/pharmacy-create').then(m => m.PharmacyCreate)
  },
  {
    path: 'pharmacies/:id/manage',
    data: { title: 'pharm.manage_title' },
    loadComponent: () =>
      import('./pages/pharmacy-manage/pharmacy-manage').then(m => m.PharmacyManage)
  },
  {
    // Declared before the list so the id route is not shadowed.
    path: 'reports/:id',
    data: { title: 'reports.report' },
    loadComponent: () => import('./pages/reports/report-details').then(m => m.ReportDetails)
  },
  {
    path: 'reports',
    data: { title: 'reports.title' },
    loadComponent: () => import('./pages/reports/reports').then(m => m.Reports)
  },
  {
    path: 'audit-logs',
    data: { title: 'audit.title' },
    loadComponent: () => import('./pages/audit-logs/audit-logs').then(m => m.AuditLogs)
  },
  {
    path: 'settings',
    data: { title: 'settings.title' },
    loadComponent: () => import('./pages/settings/settings').then(m => m.Settings)
  },
  // Clinical guidelines sit under Lists in the sidebar but are not an option
  // list: each one carries sections of bullets in two languages, which the
  // generic list drawer has no shape for. Declared before the generated
  // `lists/*` routes; the paths do not collide either way.
  {
    path: 'lists/clinical-guidelines',
    data: { title: 'guidelines.title' },
    loadComponent: () =>
      import('./pages/clinical-guidelines/clinical-guidelines').then(m => m.ClinicalGuidelines)
  },
  {
    path: 'lists/clinical-guidelines/new',
    data: { title: 'guidelines.add' },
    loadComponent: () =>
      import('./pages/clinical-guidelines/clinical-guideline-form').then(m => m.ClinicalGuidelineForm)
  },
  {
    path: 'lists/clinical-guidelines/:id/edit',
    data: { title: 'guidelines.edit' },
    loadComponent: () =>
      import('./pages/clinical-guidelines/clinical-guideline-form').then(m => m.ClinicalGuidelineForm)
  },
  // Six record lists on one screen, generated the same way the option lists
  // are: a seventh is a config entry, not a route and a component.
  ...Object.values(RECORD_LISTS).map(config => ({
    path: `records/${config.key}`,
    data: { title: config.titleKey, listKey: config.key },
    loadComponent: () => import('./pages/record-lists/record-lists').then(m => m.RecordLists)
  })),
  // One screen serves all seven option lists. The routes are generated so a new
  // list is a single entry in `OPTION_LISTS`, and each carries its own title so
  // the navbar reads like the sidebar entry that was clicked.
  ...Object.values(OPTION_LISTS).map(config => ({
    path: `lists/${config.key}`,
    data: { title: config.titleKey, listKey: config.key },
    loadComponent: () => import('./pages/option-lists/option-lists').then(m => m.OptionLists)
  })),
  // Website CMS — its own route file, guarded per screen by website permission.
  {
    path: 'website',
    loadChildren: () => import('./pages/website/website.routes').then(m => m.WEBSITE_ROUTES)
  },
  {
    path: 'notification/history',
    data: { title: 'menu.notification_history' },
    loadComponent: () =>
      import('./pages/notification-history/notification-history').then(m => m.NotificationHistory)
  },
  // Last, and it has to be last: a dashboard URL that matches nothing stops
  // here instead of falling through to the app's top-level wildcard. That
  // wildcard redirects, and the redirect is resolved on the server, which
  // cannot see a session in localStorage and so answered `302 /` — landing a
  // signed-in admin on the public marketing site.
  // ===================== Legacy mixed-case aliases =====================
  // These sections shipped with capitalised segments while every other route
  // in the dashboard is kebab-case, so the same screen was reachable as
  // `/Oncology-add` right next to `/dialysis-add`. The canonical paths above
  // are lower-case now; the old spellings stay as redirects because they are
  // in browser histories, in bookmarks, and in links already sent out.
  // `redirectTo` is a function wherever the path carries an `:id`: an
  // absolute redirect string does NOT substitute positional parameters,
  // and `/dashboard/Oncology/edit/1` landed on a literal `.../edit/:id`.
  { path: 'Advertisements', redirectTo: '/dashboard/advertisements', pathMatch: 'full' },
  { path: 'Advertisements/add', redirectTo: '/dashboard/advertisements/add', pathMatch: 'full' },
  { path: 'Advertisements/edit/:id', redirectTo: r => `/dashboard/advertisements/edit/${r.params['id']}`, pathMatch: 'full' },
  { path: 'HyperbaricOxygen', redirectTo: '/dashboard/hyperbaric-oxygen', pathMatch: 'full' },
  { path: 'HyperbaricOxygen-details/:id', redirectTo: r => `/dashboard/hyperbaric-oxygen-details/${r.params['id']}`, pathMatch: 'full' },
  { path: 'HyperbaricOxygen-add', redirectTo: '/dashboard/hyperbaric-oxygen-add', pathMatch: 'full' },
  { path: 'HyperbaricOxygen/edit/:id', redirectTo: r => `/dashboard/hyperbaric-oxygen/edit/${r.params['id']}`, pathMatch: 'full' },
  { path: 'Oncology', redirectTo: '/dashboard/oncology', pathMatch: 'full' },
  { path: 'Oncology-details/:id', redirectTo: r => `/dashboard/oncology-details/${r.params['id']}`, pathMatch: 'full' },
  { path: 'Oncology-add', redirectTo: '/dashboard/oncology-add', pathMatch: 'full' },
  { path: 'Oncology/edit/:id', redirectTo: r => `/dashboard/oncology/edit/${r.params['id']}`, pathMatch: 'full' },
  {
    path: '**',
    data: { title: 'notfound.title' },
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.DashboardNotFound)
  }
];
