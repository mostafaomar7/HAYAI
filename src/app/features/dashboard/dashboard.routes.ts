import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home.component/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'Advertisements',
    loadComponent: () =>
      import('./pages/advertisements/advertisements').then(m => m.Advertisements)
  },
  {
    path: 'Advertisements/add',
    loadComponent: () =>
      import('./pages/advertisements-details/advertisements-details').then(m => m.AdvertisementsDetails)
  },
  {
    path: 'Advertisements/edit/:id',
    loadComponent: () =>
      import('./pages/advertisements-details/advertisements-details').then(m => m.AdvertisementsDetails)
  },
  {
    path: 'charitable',
    loadComponent: () => import('./pages/charitable/charitable').then(m => m.Charitable)
  },
  {
    path: 'charitable/add',
    loadComponent: () => import('./pages/charitable-add/charitable-add').then(m => m.CharitableAdd)
  },
  {
    path: 'charitable/edit/:id',
    loadComponent: () => import('./pages/charitable-add/charitable-add').then(m => m.CharitableAdd) // ممكن تستخدم نفس كومبوننت الـ Add للتعديل
  },
  {
    path: 'charitable/details/:id',
    loadComponent: () => import('./pages/charitable-details/charitable-details').then(m => m.CharitableDetails)
  },
  {
    path: 'transactions',
    loadComponent: () => import('./pages/transaction/transaction').then(m => m.Transaction)
  },
  {
    path: 'renewal',
    loadComponent: () => import('./pages/renewal/renewal').then(m => m.Renewal)
  },
  {
    path: 'plans',
    loadComponent: () => import('./pages/plans/plans').then(m => m.Plans)
  },
  {
    path: 'plans/add',
    loadComponent: () => import('./pages/plans-add/plans-add').then(m => m.PlansAdd)
  },
  {
    path: 'plans/edit/:id',
    loadComponent: () => import('./pages/plans-add/plans-add').then(m => m.PlansAdd) // ممكن تستخدم نفس كومبوننت الـ Add للتعديل
  },
  {
    path: 'plans/details/:id',
    loadComponent: () => import('./pages/plans-details/plans-details').then(m => m.PlansDetails)
  },
  {
    path: 'notfication',
    loadComponent: () => import('./pages/notfication/notfication').then(m => m.Notfication)
  },
  {
    path: 'patient',
    loadComponent: () => import('./pages/users/patients/patients').then(m => m.Patients)
  },
  {
    path: 'tourist',
    loadComponent: () => import('./pages/users/tourists/tourists').then(m => m.Tourists)
  },
  {
    path: 'hospital',
    loadComponent: () => import('./pages/users/hospital/hospital').then(m => m.Hospital)
  },
  {
    path: 'clinics',
    loadComponent: () => import('./pages/users/clinics/clinics').then(m => m.Clinics)
  },
  {
    path: 'doctor',
    loadComponent: () => import('./pages/users/doctor/doctor').then(m => m.Doctor)
  },
  {
    path: 'pharmacies',
    loadComponent: () => import('./pages/users/pharmacies/pharmacies').then(m => m.Pharmacies)
  },
  {
    path: 'labs',
    loadComponent: () => import('./pages/users/labs/labs').then(m => m.Labs)
  },
  {
    path: 'issuance',
    loadComponent: () => import('./pages/users/medical-issuance/medical-issuance').then(m => m.MedicalIssuance)
  },
  {
    path: 'therapy',
    loadComponent: () => import('./pages/users/physical-therapy/physical-therapy').then(m => m.PhysicalTherapy)
  },
];