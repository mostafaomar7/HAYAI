import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/**
 * Dashboard access per area — backend contract of 2026-10-16
 * (docs/backend-contract/admin-access-2026-10-16.md).
 *
 * Every admin route on the API checks `<area>.view` for a read and
 * `<area>.manage` for a write, and answers 403 `ADMIN_PERMISSION_DENIED`
 * otherwise. This file only decides what to *show*: the sidebar, the route
 * guard and the write buttons follow it so a limited admin is not offered a
 * screen or a button that can only fail. It is never the security boundary.
 */

export type AdminArea =
  | 'patients' | 'doctors' | 'hospitals' | 'icu' | 'pharmacies' | 'labs'
  | 'home_care' | 'physical_therapy' | 'senior_care' | 'medical_tourism'
  | 'medical_insurance' | 'medical_devices' | 'charities' | 'employment'
  /**
   * Split out of `doctors` and `medical_devices` respectively, so a
   * super-admin can grant one section without the other (backend of
   * 2026-10-19). `medical_devices` now means the internal marketplace and
   * the device-company accounts only.
   */
  | 'clinical_guidelines' | 'external_devices'
  | 'subscriptions' | 'advertisements' | 'notifications' | 'support'
  | 'account_deletion' | 'statistics' | 'ai' | 'platform_settings' | 'audit_log';

export type AccessLevel = 'view' | 'manage';

/**
 * An area that was carved out of another, and the one it came from.
 *
 * Read only while a server predates the split: the backend gives the new area
 * to every role that held the old one, so until `areas` carries the new key,
 * the old key is the same answer. Once it does, this table is never reached.
 *
 * As of backend `bf7c1b3` (2026-10-19) it is **already unreachable** —
 * `/admin/access/me` returns 25 areas including both, and all twelve roles
 * were measured to hold the new area wherever they hold the parent, at the
 * same level. It is kept deliberately: it costs one lookup, it is what saves
 * us if that deploy is rolled back, and the next split reuses it. Do not read
 * it as live behaviour.
 */
const AREA_SPLIT_FROM: Partial<Record<AdminArea, AdminArea>> = {
  clinical_guidelines: 'doctors',
  external_devices: 'medical_devices'
};

/** Marks a screen for super-admins only (admin accounts, roles). */
export const SUPER_ADMIN_ONLY = 'super-admin';

export interface AdminAccess {
  is_super_admin: boolean;
  roles: string[];
  /** `manage` already carries the `view` it implies. */
  permissions: string[];
  website_permissions: string[];
  /** Every area key, always. */
  areas: Partial<Record<AdminArea, { view: boolean; manage: boolean }>>;
}

export interface AdminAccessMe extends AdminAccess {
  id: number;
  name: string;
  email: string;
  must_change_password: boolean;
}

/**
 * The record types an activity screen opens, and the area each belongs to.
 * The same table the backend routes `admin_transaction_created` alerts by.
 */
export const RECORD_TYPE_AREA: Record<string, AdminArea> = {
  doctor_request: 'doctors',
  icu_request: 'icu',
  hospital_request: 'hospitals',
  blood_request: 'hospitals',
  transportation_request: 'hospitals',
  lab_request: 'labs',
  lab_order: 'labs',
  pharmacy_order: 'pharmacies',
  device_order: 'medical_devices',
  home_care_request: 'home_care',
  physical_therapy_request: 'physical_therapy',
  insurance_request: 'medical_insurance',
  insurance_limit_request: 'medical_insurance',
  medical_tourism_request: 'medical_tourism',
  employee_office_booking: 'employment',
  job_application: 'employment'
};

/**
 * Dashboard path (after `/dashboard/`) → area. First match wins, so the
 * longer prefixes sit above the shorter ones they share a start with
 * (`lists/clinical-guidelines` before any generic `lists/`).
 *
 * Not listed, so open to every admin: the home page (it hides its own charts
 * without `statistics`), profile, change-password, no-access, the Website CMS
 * (gated by its own permissions) and `users/:id/activity`, whose area depends
 * on the account and is only known to the server.
 */
const PATH_AREAS: [RegExp, AdminArea | typeof SUPER_ADMIN_ONLY][] = [
  [/^access(\/|$)/, SUPER_ADMIN_ONLY],
  [/^(patient|tourist)(\/|$)/, 'patients'],
  [/^lists\/clinical-guidelines/, 'clinical_guidelines'],
  [/^(doctor|lists\/doctor-)/, 'doctors'],
  [/^(hospital|clinics|hospital-verifications)(\/|$)/, 'hospitals'],
  [/^lists\/icu-/, 'icu'],
  [/^(pharmacies|records\/pharmacy-orders)(\/|$)/, 'pharmacies'],
  [/^labs(\/|$)/, 'labs'],
  [/^home-care(\/|$)/, 'home_care'],
  [/^(therapy|records\/physical-therapy-requests)(\/|$)/, 'physical_therapy'],
  [/^lists\/mt-/, 'medical_tourism'],
  [/^(issuance|lists\/insurance-providers|records\/insurance-(limit-)?requests)(\/|$)/, 'medical_insurance'],
  [/^group-orders(\/|$)/, 'external_devices'],
  [/^(medical-devices|external|internal-devices)(\/|$)/, 'medical_devices'],
  [/^(charitable|dialysis|hyperbaric-oxygen|oncology)/, 'charities'],
  [/^(employment|records\/jobs|records\/job-applications)(\/|$)/, 'employment'],
  [/^(plans|renewal)(\/|$)/, 'subscriptions'],
  [/^advertisements(\/|$)/, 'advertisements'],
  [/^notification(\/|$)/, 'notifications'],
  [/^reports(\/|$)/, 'support'],
  [/^account-deletion-requests(\/|$)/, 'account_deletion'],
  [/^audit-logs(\/|$)/, 'audit_log'],
  [/^settings(\/|$)/, 'platform_settings']
];

/**
 * The area a dashboard URL belongs to, or null when every admin may open it.
 * Takes the full URL (`/dashboard/pharmacies?page=2`).
 */
export function areaForUrl(url: string): AdminArea | typeof SUPER_ADMIN_ONLY | null {
  const path = url.split(/[?#]/)[0].replace(/^\/dashboard\/?/, '');
  const activity = /^activity\/([a-z_]+)\//.exec(path);
  if (activity) return RECORD_TYPE_AREA[activity[1]] ?? null;
  for (const [re, area] of PATH_AREAS) if (re.test(path)) return area;
  return null;
}

@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  /**
   * A fresher copy from `/admin/access/me`, over the one login brought.
   * Kept with the id it belongs to, so the next admin to sign in on this
   * browser never sees the previous one's access.
   */
  private fresh = signal<{ userId: number; access: AdminAccess } | null>(null);

  /**
   * Null before the session is known, and on an account the API sent no
   * `admin_access` for. The second case is a backend from before the
   * release, where every admin could do everything; it reads as
   * super-admin so the dashboard behaves exactly as it did then.
   */
  readonly access = computed<AdminAccess | null>(() => {
    const user = this.auth.currentUser();
    if (!user) return null;
    const fresh = this.fresh();
    if (fresh && fresh.userId === user.id) return fresh.access;
    return user.admin_access ?? LEGACY_FULL_ACCESS;
  });

  readonly isSuperAdmin = computed(() => !!this.access()?.is_super_admin);

  can(area: AdminArea | typeof SUPER_ADMIN_ONLY | null | undefined, level: AccessLevel = 'view'): boolean {
    if (!area) return true;
    const a = this.access();
    if (!a) return false;
    if (a.is_super_admin) return true;
    if (area === SUPER_ADMIN_ONLY) return false;
    const own = a.areas[area]?.[level];
    if (own !== undefined) return own;
    // An area this server has not shipped yet is absent from `areas`, and an
    // absent key would otherwise read as "denied" — which would take Clinical
    // guidelines and Group orders away from every limited admin between this
    // release and the backend's. Both were carved out of an older area, and
    // the backend grants the new one to everyone who held the old one, so
    // falling back to the parent is what that same admin already has.
    const parent = AREA_SPLIT_FROM[area];
    return parent ? !!a.areas[parent]?.[level] : false;
  }

  canWebsite(permission: string): boolean {
    const a = this.access();
    return !!a && (a.is_super_admin || a.website_permissions.includes(permission));
  }

  /** Can the admin open this dashboard URL? */
  canOpen(url: string): boolean {
    return this.can(areaForUrl(url));
  }

  /** Can the admin change things on this dashboard URL's screen? */
  canManageAt(url: string): boolean {
    const area = areaForUrl(url);
    // Pages with no area of their own (profile, the home page) keep their
    // buttons; the API still answers for anything they do.
    return area === null || this.can(area, 'manage');
  }

  private pending: Observable<AdminAccessMe | null> | null = null;

  /**
   * Re-reads the admin's access. A super-admin's role change takes effect on
   * the admin's next request, so this is called after the change and after
   * any 403 — the screen then catches up with what the server already does.
   */
  refresh(): Observable<AdminAccessMe | null> {
    if (this.pending) return this.pending;
    this.pending = this.api.get<AdminAccessMe>('/admin/access/me').pipe(
      tap(me => {
        this.fresh.set({ userId: me.id, access: me });
        const user = this.auth.currentUser();
        if (user && user.must_change_password !== me.must_change_password) {
          this.auth.setUser({ ...user, must_change_password: me.must_change_password });
        }
      }),
      catchError(() => of(null)),
      finalize(() => { this.pending = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.pending;
  }

}

const LEGACY_FULL_ACCESS: AdminAccess = {
  is_super_admin: true,
  roles: [],
  permissions: [],
  website_permissions: [],
  areas: {}
};
