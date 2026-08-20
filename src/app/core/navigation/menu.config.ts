import { MenuItem } from '../models/menu-item.model';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'menu.dashboard', iconName: 'dashboard', route: '/dashboard', roles: ['admin'] },
  { id: 'Advertisements', label: 'menu.advertisements', iconName: 'advertisements', route: '/dashboard/Advertisements', roles: ['admin'] },
  { id: 'CharitableOrganizations', label: 'menu.charitable', iconName: 'charitable', route: '/dashboard/charitable', roles: ['admin'] },
  // There is no admin-wide transactions endpoint — `/api/v1/transactions` is
  // scoped to the caller. A menu entry will need a new endpoint first.
  { id: 'RenewalUsers', label: 'menu.renewal', iconName: 'renewal', route: '/dashboard/renewal', roles: ['admin'] },
  { id: 'PlansManagements', label: 'menu.plans', iconName: 'plans', route: '/dashboard/plans', roles: ['admin'] },
  { id: 'SendNotifications', label: 'menu.send_notifications', iconName: 'notifications', route: '/dashboard/notfication', roles: ['admin'] },
  { id: 'NotificationHistory', label: 'menu.notification_history', iconName: 'notifications', route: '/dashboard/notfication/history', roles: ['admin'] },
  // Hidden from the sidebar on request. The page, its route and its service are
  // all still in place — restore this line to bring the entry back.
  // { id: 'HospitalVerifications', label: 'menu.hospital_verifications', iconName: 'centers', route: '/dashboard/hospital-verifications', roles: ['admin'] },

  {
    id: 'Users', label: 'menu.users', iconName: 'users', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Patients', label: 'menu.users.patients', route: '/dashboard/patient' },
      { id: 'Tourists', label: 'menu.users.tourists', route: '/dashboard/tourist' },
      { id: 'Hospitals', label: 'menu.users.hospitals', route: '/dashboard/hospital' },
      { id: 'Clinics', label: 'menu.users.clinics', route: '/dashboard/clinics' },
      { id: 'Doctors', label: 'menu.users.doctors', route: '/dashboard/doctor' },
      { id: 'Pharmacies', label: 'menu.users.pharmacies', route: '/dashboard/pharmacies' },
      { id: 'Labs', label: 'menu.users.labs', route: '/dashboard/labs' },
      { id: 'Issuance', label: 'menu.users.issuance', route: '/dashboard/issuance' },
      { id: 'HomeCare', label: 'menu.users.home_care', route: '/dashboard/home-care' },
      { id: 'Therapy', label: 'menu.users.therapy', route: '/dashboard/therapy' },
      { id: 'Employment', label: 'menu.users.employment', route: '/dashboard/employment' },
      { id: 'MedicalDevices', label: 'menu.users.medical_devices', route: '/dashboard/medical-devices' },
    ]
  },
  {
    id: 'Centers', label: 'menu.centers', iconName: 'centers', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Dialysis', label: 'menu.centers.dialysis', route: '/dashboard/dialysis' },
      { id: 'Hyperbaric', label: 'menu.centers.hyperbaric', route: '/dashboard/HyperbaricOxygen' },
      { id: 'Oncology', label: 'menu.centers.oncology', route: '/dashboard/Oncology' },
    ]
  },
  // The option lists a provider's forms read and can never write. Adding one
  // used to need a deploy; these screens are what replaced that.
  {
    id: 'OptionLists', label: 'menu.lists', iconName: 'plans', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'IcuGroups', label: 'lists.icu_groups', route: '/dashboard/lists/icu-specialty-groups' },
      { id: 'IcuCategories', label: 'lists.icu_categories', route: '/dashboard/lists/icu-specialty-categories' },
      { id: 'IcuSpecialties', label: 'lists.icu_specialties', route: '/dashboard/lists/icu-specialties' },
      { id: 'IcuTeamRoles', label: 'lists.icu_team_roles', route: '/dashboard/lists/icu-team-roles' },
      { id: 'MtSpecialties', label: 'lists.mt_specialties', route: '/dashboard/lists/mt-specialties' },
      { id: 'MtSubspecialties', label: 'lists.mt_subspecialties', route: '/dashboard/lists/mt-subspecialties' },
      { id: 'InsuranceProviders', label: 'lists.insurance', route: '/dashboard/lists/insurance-providers' },
    ]
  },
  {
    id: 'ExternalMedicalDevices', label: 'menu.external_devices', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Devices', label: 'menu.external_devices.devices', route: '/dashboard/external/devices' },
      { id: 'Orders', label: 'menu.external_devices.orders', route: '/dashboard/external/orders' },
    ]
  },
];
