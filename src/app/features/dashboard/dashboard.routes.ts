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
    path: 'Advertisements',
    data: { title: 'menu.advertisements' },
    loadComponent: () =>
      import('./pages/advertisements/advertisements').then(m => m.Advertisements)
  },
  {
    path: 'Advertisements/add',
    data: { title: 'menu.advertisements' },
    loadComponent: () =>
      import('./pages/advertisements-details/advertisements-details').then(m => m.AdvertisementsDetails)
  },
  {
    path: 'Advertisements/edit/:id',
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
    path: 'notfication',
    data: { title: 'menu.send_notifications' },
    loadComponent: () => import('./pages/notfication/notfication').then(m => m.Notfication)
  },
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
    path: 'HyperbaricOxygen',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () => import('./pages/Centers/hyperbaric-oxygen/hyperbaric-oxygen').then(m => m.HyperbaricOxygen)
  },
  {
    path: 'HyperbaricOxygen-details/:id',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () => import('./pages/Centers/hyperbaric-oxygen-details/hyperbaric-oxygen-details').then(m => m.HyperbaricOxygenDetails)
  },
  {
    path: 'HyperbaricOxygen-add',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () =>
      import('./pages/Centers/hyperbaric-oxygen-add/hyperbaric-oxygen-add').then(m => m.HyperbaricOxygenAdd)
  },
  {
    path: 'HyperbaricOxygen/edit/:id',
    data: { title: 'menu.centers.hyperbaric' },
    loadComponent: () =>
      import('./pages/Centers/hyperbaric-oxygen-add/hyperbaric-oxygen-add').then(m => m.HyperbaricOxygenAdd)
  },
  {
    path: 'Oncology',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () => import('./pages/Centers/oncology/oncology').then(m => m.Oncology)
  },
  {
    path: 'Oncology-details/:id',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () => import('./pages/Centers/oncology-details/oncology-details').then(m => m.OncologyDetails)
  },
  {
    path: 'Oncology-add',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () =>
      import('./pages/Centers/oncology-add/oncology-add').then(m => m.OncologyAdd)
  },
  {
    path: 'Oncology/edit/:id',
    data: { title: 'menu.centers.oncology' },
    loadComponent: () =>
      import('./pages/Centers/oncology-add/oncology-add').then(m => m.OncologyAdd)
  },
  {
    path: 'hospital-verifications',
    data: { title: 'menu.hospital_verifications' },
    loadComponent: () =>
      import('./pages/hospital-verifications/hospital-verifications').then(m => m.HospitalVerifications)
  },
  {
    path: 'external/devices',
    data: { title: 'menu.external_devices.devices' },
    loadComponent: () =>
      import('./pages/external-devices/external-devices').then(m => m.ExternalDevices)
  },
  {
    path: 'external/orders/:id',
    data: { title: 'external.orders.order' },
    loadComponent: () =>
      import('./pages/external-order-details/external-order-details').then(m => m.ExternalOrderDetails)
  },
  {
    path: 'external/orders',
    data: { title: 'menu.external_devices.orders' },
    loadComponent: () =>
      import('./pages/external-orders/external-orders').then(m => m.ExternalOrders)
  },
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
    path: 'notfication/history',
    data: { title: 'menu.notification_history' },
    loadComponent: () =>
      import('./pages/notification-history/notification-history').then(m => m.NotificationHistory)
  },
];
