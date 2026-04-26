import { MenuItem } from '../models/menu-item.model';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard', route: '/dashboard', roles: ['admin'] },
  { id: 'Advertisements', label: 'Advertisements', iconName: 'advertisements', route: '/dashboard/Advertisements', roles: ['admin'] },
  { id: 'CharitableOrganizations', label: 'Charitable Organizations', iconName: 'charitable', route: '/dashboard/charitable', roles: ['admin'] },
  { id: 'Transactions', label: 'Transactions', iconName: 'transactions', route: '/dashboard/transactions', roles: ['admin'] },
  { id: 'RenewalUsers', label: 'Renewal Users', iconName: 'renewal', route: '/dashboard/renewal', roles: ['admin'] },
  { id: 'PlansManagements', label: 'Plans Managements', iconName: 'plans', route: '/dashboard/plans', roles: ['admin'] },
  { id: 'SendNotifications', label: 'Send Notifications', iconName: 'notifications', route: '/dashboard/notfication', roles: ['admin'] },
  
  // القوائم المنسدلة
  { 
    id: 'Users', label: 'Users', iconName: 'users', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Patients', label: 'Patients', route: '/dashboard/patient' },
      { id: 'Tourists', label: 'Tourists', route: '/dashboard/tourist' },
      { id: 'Hospitals', label: 'Hospitals', route: '/dashboard/hospital' },
      { id: 'Clinics', label: 'Clinics', route: '/dashboard/clinics' },
      { id: 'Doctors', label: 'Doctors', route: '/dashboard/doctor' },
      { id: 'Pharmacies', label: 'Pharmacies', route: '/dashboard/pharmacies' },
      { id: 'Labs', label: 'Labs & Radiology', route: '/dashboard/labs' },
      { id: 'Issuance', label: 'Medical Issuance', route: '/dashboard/issuance' },
      { id: 'HomeCare', label: 'Home Care', route: '/dashboard/home-care' },
      { id: 'Therapy', label: 'Physical Therapy', route: '/dashboard/therapy' },
      { id: 'Employment', label: 'Employment Office', route: '/dashboard/employment' },
      { id: 'MedicalDevices', label: 'Medical Devices', route: '/dashboard/medical-devices' },
    ]
  },
  { 
    id: 'Centers', label: 'Centers', iconName: 'centers', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Dialysis', label: 'Dialysis', route: '/dashboard/centers/dialysis' },
      { id: 'Hyperbaric', label: 'Hyperbaric Oxygen', route: '/dashboard/centers/hyperbaric' },
      { id: 'Oncology', label: 'Oncology', route: '/dashboard/centers/oncology' },
    ]
  },
  { 
    id: 'ExternalMedicalDevices', label: 'External Medical Devices', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Devices', label: 'Devices', route: '/dashboard/external/devices' },
      { id: 'Orders', label: 'Orders', route: '/dashboard/external/orders' },
    ]
  },
];