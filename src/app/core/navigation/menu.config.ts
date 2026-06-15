import { MenuItem } from '../models/menu-item.model';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'menu.dashboard', iconName: 'dashboard', route: '/dashboard', roles: ['admin'] },
  { id: 'Advertisements', label: 'menu.advertisements', iconName: 'advertisements', route: '/dashboard/Advertisements', roles: ['admin'] },
  { id: 'CharitableOrganizations', label: 'menu.charitable', iconName: 'charitable', route: '/dashboard/charitable', roles: ['admin'] },
  // Transactions admin endpoint is not built on the backend yet (see backend integration guide §13).
  // Re-enable once /admin/transactions ships.
  // { id: 'Transactions', label: 'menu.transactions', iconName: 'transactions', route: '/dashboard/transactions', roles: ['admin'] },
  { id: 'RenewalUsers', label: 'menu.renewal', iconName: 'renewal', route: '/dashboard/renewal', roles: ['admin'] },
  { id: 'PlansManagements', label: 'menu.plans', iconName: 'plans', route: '/dashboard/plans', roles: ['admin'] },
  { id: 'SendNotifications', label: 'menu.send_notifications', iconName: 'notifications', route: '/dashboard/notfication', roles: ['admin'] },
  { id: 'NotificationHistory', label: 'menu.notification_history', iconName: 'notifications', route: '/dashboard/notfication/history', roles: ['admin'] },
  { id: 'HospitalVerifications', label: 'menu.hospital_verifications', iconName: 'centers', route: '/dashboard/hospital-verifications', roles: ['admin'] },

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
  {
    id: 'ExternalMedicalDevices', label: 'menu.external_devices', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Devices', label: 'menu.external_devices.devices', route: '/dashboard/external/devices' },
      { id: 'Orders', label: 'menu.external_devices.orders', route: '/dashboard/external/orders' },
    ]
  },
];
