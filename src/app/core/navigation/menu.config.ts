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
      { id: 'DoctorSpecialties', label: 'lists.doctor_specialties', route: '/dashboard/lists/doctor-specialties' },
      { id: 'DoctorSubspecialties', label: 'lists.doctor_subspecialties', route: '/dashboard/lists/doctor-subspecialties' },
      { id: 'ClinicalGuidelines', label: 'guidelines.title', route: '/dashboard/lists/clinical-guidelines' },
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
  {
    id: 'Reports', label: 'reports.title', iconName: 'plans', route: '/dashboard/reports', roles: ['admin'],
  },
  {
    id: 'AuditLogs', label: 'audit.title', iconName: 'plans', route: '/dashboard/audit-logs', roles: ['admin'],
  },
  {
    id: 'Settings', label: 'settings.title', iconName: 'plans', route: '/dashboard/settings', roles: ['admin'],
  },
  {
    id: 'RecordLists', label: 'menu.records', iconName: 'plans', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'RecPharmacyOrders', label: 'records.pharmacy_orders', route: '/dashboard/records/pharmacy-orders' },
      { id: 'RecTherapyRequests', label: 'records.therapy_requests', route: '/dashboard/records/physical-therapy-requests' },
      { id: 'RecInsuranceRequests', label: 'records.insurance_requests', route: '/dashboard/records/insurance-requests' },
      { id: 'RecLimitRequests', label: 'records.limit_requests', route: '/dashboard/records/insurance-limit-requests' },
      { id: 'RecJobs', label: 'records.jobs', route: '/dashboard/records/jobs' },
      { id: 'RecJobApplications', label: 'records.job_applications', route: '/dashboard/records/job-applications' },
    ]
  },
  {
    id: 'GroupOrders', label: 'menu.external_devices_section', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'GroupOrdersOverview', label: 'menu.group_orders.overview', route: '/dashboard/group-orders' },
      { id: 'GroupOrderDevices', label: 'menu.group_orders.devices', route: '/dashboard/group-orders/devices' },
      { id: 'GroupOrderCategories', label: 'menu.group_orders.categories', route: '/dashboard/group-orders/categories' },
      { id: 'GroupOrderCompanies', label: 'menu.group_orders.companies', route: '/dashboard/group-orders/shipping-companies' },
    ]
  },
  // Website CMS (the public site at hayaihealthcare.com). Each entry carries the granular
  // permission its screen needs; the sidebar hides what the admin cannot open.
  {
    id: 'Website', label: 'menu.website', iconName: 'website', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'WebOverview', label: 'menu.website.overview', route: '/dashboard/website', permission: 'cms.view' },
      { id: 'WebPages', label: 'menu.website.pages', route: '/dashboard/website/pages', permission: 'cms.view' },
      { id: 'WebArticles', label: 'menu.website.articles', route: '/dashboard/website/articles', permission: 'cms.view' },
      { id: 'WebProducts', label: 'menu.website.products', route: '/dashboard/website/products', permission: 'products.view' },
      { id: 'WebCategories', label: 'menu.website.categories', route: '/dashboard/website/categories', permission: 'cms.view' },
      { id: 'WebCtas', label: 'menu.website.ctas', route: '/dashboard/website/ctas', permission: 'cms.view' },
      { id: 'WebForms', label: 'menu.website.forms', route: '/dashboard/website/forms', permission: 'cms.view' },
      { id: 'WebFaqs', label: 'menu.website.faqs', route: '/dashboard/website/faqs', permission: 'cms.view' },
      { id: 'WebAuthors', label: 'menu.website.authors', route: '/dashboard/website/authors', permission: 'cms.view' },
      { id: 'WebMedia', label: 'menu.website.media', route: '/dashboard/website/media', permission: 'media.view' },
      { id: 'WebMenus', label: 'menu.website.menus', route: '/dashboard/website/menus', permission: 'cms.view' },
    ]
  },
  {
    id: 'WebsiteGrowth', label: 'menu.website_growth', iconName: 'growth', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'WebPurchases', label: 'menu.website.purchases', route: '/dashboard/website/purchases', permission: 'orders.view' },
      { id: 'WebLeads', label: 'menu.website.leads', route: '/dashboard/website/leads', permission: 'leads.view' },
      { id: 'WebAnalytics', label: 'menu.website.analytics', route: '/dashboard/website/analytics', permission: 'analytics.view' },
      { id: 'WebCrawlers', label: 'menu.website.crawlers', route: '/dashboard/website/crawlers', permission: 'seo.view' },
      { id: 'WebRedirects', label: 'menu.website.redirects', route: '/dashboard/website/redirects', permission: 'redirects.view' },
      { id: 'WebSettings', label: 'menu.website.settings', route: '/dashboard/website/settings', permission: 'settings.view' },
      { id: 'WebAudit', label: 'menu.website.audit', route: '/dashboard/website/audit', permission: 'audit.view' },
      { id: 'WebRoles', label: 'menu.website.roles', route: '/dashboard/website/roles', permission: 'roles.manage' },
    ]
  },
];
