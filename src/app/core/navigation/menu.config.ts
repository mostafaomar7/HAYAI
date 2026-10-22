import { MenuItem } from '../models/menu-item.model';
import { SUPER_ADMIN_ONLY } from '../services/admin-access.service';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'menu.dashboard', iconName: 'dashboard', route: '/dashboard', roles: ['admin'] },
  { id: 'Advertisements', label: 'menu.advertisements', iconName: 'advertisements', route: '/dashboard/advertisements', area: 'advertisements', roles: ['admin'] },
  { id: 'CharitableOrganizations', label: 'menu.charitable', iconName: 'charitable', route: '/dashboard/charitable', area: 'charities', roles: ['admin'] },
  // There is no admin-wide transactions endpoint — `/api/v1/transactions` is
  // scoped to the caller. A menu entry will need a new endpoint first.
  { id: 'RenewalUsers', label: 'menu.renewal', iconName: 'renewal', route: '/dashboard/renewal', area: 'subscriptions', roles: ['admin'] },
  { id: 'AccountDeletionRequests', label: 'menu.deletion_requests', iconName: 'renewal', route: '/dashboard/account-deletion-requests', area: 'account_deletion', roles: ['admin'] },
  // Four screens now, so it is a section rather than one entry. A dropdown
  // whose children are all hidden is dropped by the sidebar, so an admin
  // without `ai` sees nothing here at all.
  {
    id: 'Ai', label: 'menu.ai', iconName: 'notifications', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'AiOverview', label: 'menu.ai_overview', route: '/dashboard/ai/overview', area: 'ai' },
      { id: 'AiTokenRequests', label: 'menu.ai_token_requests', route: '/dashboard/ai/token-requests', area: 'ai' },
      { id: 'AiUsage', label: 'menu.ai_usage', route: '/dashboard/ai/usage', area: 'ai' },
      { id: 'AiGrants', label: 'menu.ai_grants', route: '/dashboard/ai/allocations', area: 'ai' },
    ]
  },
  { id: 'PlansManagements', label: 'menu.plans', iconName: 'plans', route: '/dashboard/plans', area: 'subscriptions', roles: ['admin'] },
  { id: 'SendNotifications', label: 'menu.send_notifications', iconName: 'notifications', route: '/dashboard/notification', area: 'notifications', roles: ['admin'] },
  { id: 'NotificationHistory', label: 'menu.notification_history', iconName: 'notifications', route: '/dashboard/notification/history', area: 'notifications', roles: ['admin'] },
  // Hidden from the sidebar on request. The page, its route and its service are
  // all still in place — restore this line to bring the entry back.
  // { id: 'HospitalVerifications', label: 'menu.hospital_verifications', iconName: 'centers', route: '/dashboard/hospital-verifications', roles: ['admin'] },

  {
    id: 'Users', label: 'menu.users', iconName: 'users', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Patients', label: 'menu.users.patients', route: '/dashboard/patient', area: 'patients' },
      { id: 'Tourists', label: 'menu.users.tourists', route: '/dashboard/tourist', area: 'patients' },
      { id: 'Hospitals', label: 'menu.users.hospitals', route: '/dashboard/hospital', area: 'hospitals' },
      { id: 'SeniorCare', label: 'menu.users.senior_care', route: '/dashboard/senior-care', area: 'senior_care' },
      { id: 'Clinics', label: 'menu.users.clinics', route: '/dashboard/clinics', area: 'hospitals' },
      { id: 'Doctors', label: 'menu.users.doctors', route: '/dashboard/doctor', area: 'doctors' },
      { id: 'Pharmacies', label: 'menu.users.pharmacies', route: '/dashboard/pharmacies', area: 'pharmacies' },
      { id: 'Labs', label: 'menu.users.labs', route: '/dashboard/labs', area: 'labs' },
      { id: 'Issuance', label: 'menu.users.issuance', route: '/dashboard/issuance', area: 'medical_insurance' },
      { id: 'HomeCare', label: 'menu.users.home_care', route: '/dashboard/home-care', area: 'home_care' },
      { id: 'Therapy', label: 'menu.users.therapy', route: '/dashboard/therapy', area: 'physical_therapy' },
      { id: 'Employment', label: 'menu.users.employment', route: '/dashboard/employment', area: 'employment' },
      { id: 'MedicalDevices', label: 'menu.users.medical_devices', route: '/dashboard/medical-devices', area: 'medical_devices' },
    ]
  },
  {
    id: 'Centers', label: 'menu.centers', iconName: 'centers', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Dialysis', label: 'menu.centers.dialysis', route: '/dashboard/dialysis', area: 'charities' },
      { id: 'Hyperbaric', label: 'menu.centers.hyperbaric', route: '/dashboard/hyperbaric-oxygen', area: 'charities' },
      { id: 'Oncology', label: 'menu.centers.oncology', route: '/dashboard/oncology', area: 'charities' },
    ]
  },
  // The option lists a provider's forms read and can never write. Adding one
  // used to need a deploy; these screens are what replaced that.
  {
    id: 'OptionLists', label: 'menu.lists', iconName: 'plans', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'DoctorSpecialties', label: 'lists.doctor_specialties', route: '/dashboard/lists/doctor-specialties', area: 'doctors' },
      { id: 'DoctorSubspecialties', label: 'lists.doctor_subspecialties', route: '/dashboard/lists/doctor-subspecialties', area: 'doctors' },
      { id: 'ClinicalGuidelines', label: 'guidelines.title', route: '/dashboard/lists/clinical-guidelines', area: 'clinical_guidelines' },
      { id: 'IcuGroups', label: 'lists.icu_groups', route: '/dashboard/lists/icu-specialty-groups', area: 'icu' },
      { id: 'IcuCategories', label: 'lists.icu_categories', route: '/dashboard/lists/icu-specialty-categories', area: 'icu' },
      { id: 'IcuSpecialties', label: 'lists.icu_specialties', route: '/dashboard/lists/icu-specialties', area: 'icu' },
      { id: 'IcuTeamRoles', label: 'lists.icu_team_roles', route: '/dashboard/lists/icu-team-roles', area: 'icu' },
      { id: 'MtSpecialties', label: 'lists.mt_specialties', route: '/dashboard/lists/mt-specialties', area: 'medical_tourism' },
      { id: 'MtSubspecialties', label: 'lists.mt_subspecialties', route: '/dashboard/lists/mt-subspecialties', area: 'medical_tourism' },
      { id: 'InsuranceProviders', label: 'lists.insurance', route: '/dashboard/lists/insurance-providers', area: 'medical_insurance' },
    ]
  },
  {
    id: 'ExternalMedicalDevices', label: 'menu.external_devices', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'Devices', label: 'menu.external_devices.devices', route: '/dashboard/internal-devices/devices', area: 'medical_devices' },
      { id: 'Orders', label: 'menu.external_devices.orders', route: '/dashboard/internal-devices/orders', area: 'medical_devices' },
    ]
  },
  {
    id: 'Reports', label: 'reports.title', iconName: 'plans', route: '/dashboard/reports', roles: ['admin'], area: 'support',
  },
  {
    id: 'AuditLogs', label: 'audit.title', iconName: 'plans', route: '/dashboard/audit-logs', roles: ['admin'], area: 'audit_log',
  },
  {
    id: 'Settings', label: 'settings.title', iconName: 'plans', route: '/dashboard/settings', roles: ['admin'], area: 'platform_settings',
  },
  // Admin accounts and roles. Super-admin only, on the API as well.
  {
    id: 'Access', label: 'menu.access', iconName: 'users', route: '', roles: ['admin'], hasDropdown: true, area: SUPER_ADMIN_ONLY,
    children: [
      { id: 'AccessAdmins', label: 'menu.access.admins', route: '/dashboard/access/admins', area: SUPER_ADMIN_ONLY },
      { id: 'AccessRoles', label: 'menu.access.roles', route: '/dashboard/access/roles', area: SUPER_ADMIN_ONLY },
    ]
  },
  {
    id: 'RecordLists', label: 'menu.records', iconName: 'plans', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'RecPharmacyOrders', label: 'records.pharmacy_orders', route: '/dashboard/records/pharmacy-orders', area: 'pharmacies' },
      { id: 'RecTherapyRequests', label: 'records.therapy_requests', route: '/dashboard/records/physical-therapy-requests', area: 'physical_therapy' },
      { id: 'RecInsuranceRequests', label: 'records.insurance_requests', route: '/dashboard/records/insurance-requests', area: 'medical_insurance' },
      { id: 'RecLimitRequests', label: 'records.limit_requests', route: '/dashboard/records/insurance-limit-requests', area: 'medical_insurance' },
      { id: 'RecJobs', label: 'records.jobs', route: '/dashboard/records/jobs', area: 'employment' },
      { id: 'RecJobApplications', label: 'records.job_applications', route: '/dashboard/records/job-applications', area: 'employment' },
    ]
  },
  {
    // Its own permission area since 2026-10-19, separate from the internal
    // marketplace above. Note the key names: `menu.external_devices_section`
    // renders "External Medical Devices" and `menu.external_devices` renders
    // "Internal Medical Devices" — legacy spellings that say the opposite of
    // the words they produce. The routes are what to trust.
    id: 'GroupOrders', label: 'menu.external_devices_section', iconName: 'devices', route: '', roles: ['admin'], hasDropdown: true,
    children: [
      { id: 'GroupOrdersOverview', label: 'menu.group_orders.overview', route: '/dashboard/group-orders', area: 'external_devices' },
      { id: 'GroupOrderDevices', label: 'menu.group_orders.devices', route: '/dashboard/group-orders/devices', area: 'external_devices' },
      { id: 'GroupOrderCategories', label: 'menu.group_orders.categories', route: '/dashboard/group-orders/categories', area: 'external_devices' },
      { id: 'GroupOrderCompanies', label: 'menu.group_orders.companies', route: '/dashboard/group-orders/shipping-companies', area: 'external_devices' },
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
      // No audit entry here. `/admin/website/audit-logs` and `/admin/audit-logs`
      // answer with the same rows — measured 2026-10-13: both report 740
      // entries and the same ids — so the menu was offering one log twice,
      // under "Audit log" and "Audit Log". The top-level entry is the one
      // kept: it is open to every admin, where this route is gated on
      // `audit.view` and would turn into a dead link for anyone without it.
      // The page and its route stay, so existing links still work.
      // No roles entry here any more. The API made the website role screens
      // super-admin only (2026-10-16), and Access → Roles edits the same
      // roles with their website permissions included, so one screen does
      // both. `website/roles` redirects there.
    ]
  },
];
