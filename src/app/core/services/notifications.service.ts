import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export type NotificationCategory = 'userActivity' | 'system';

export interface SystemNotification {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  relative_time: string;
  unread: boolean;
  category: NotificationCategory;
  link: string | null;
}

export interface UnreadCount {
  userActivity: number;
  system: number;
  total: number;
}

export type BroadcastGender = 'male' | 'female';

/**
 * The API's account-type id, and the name this dashboard already uses for it.
 *
 * `/lookups/user-types` answers English labels and ignores `Accept-Language`
 * (measured 2026-10-15), so its `label` cannot be shown on an Arabic screen.
 * The ids come from the API, which is the half that has to be right; the
 * words come from us, which is the half that has to be readable.
 *
 * Note the three that do not match the names used elsewhere in this
 * dashboard: `pharmacies`, `labs_radiology` and `medical_insurance`.
 */
export const USER_TYPE_LABEL: Record<string, string> = {
  patient: 'users.patient.title',
  tourist: 'users.tourist.title',
  doctor: 'users.doctor.title',
  hospital: 'users.hospital.title',
  clinic: 'users.clinic.title',
  pharmacies: 'users.pharmacy.title',
  labs_radiology: 'users.lab.title',
  medical_insurance: 'users.issuance.title',
  home_care: 'users.home_care.title',
  physical_therapy: 'users.therapy.title',
  employment_office: 'users.employment.title',
  medical_devices: 'users.medical_devices.title',
  admin: 'notif.send.type.admin'
};

export interface BroadcastTarget {
  type: 'all' | 'user_type' | 'segment';
  /** Values from `/lookups/user-types` — NOT the names this dashboard uses
   *  elsewhere. The API calls them `pharmacies`, `labs_radiology` and
   *  `medical_insurance`; sending `pharmacy`, `lab` or `medical_issuance` is
   *  accepted and reaches nobody. */
  userTypes?: string[];
  /** Narrows `patient` and `tourist` only; every other selected type is
   *  untouched. An account with no gender recorded matches neither value. */
  genders?: BroadcastGender[];
  /** Both narrow `doctor` only, and a doctor matches either one. */
  specialtyIds?: number[];
  subspecialtyIds?: number[];
}

/**
 * A doctor specialty or subspecialty as `/doctor/specialties` serves it.
 *
 * Not `/lookups/doctor-specialties`, which answers `{id, name}` in English
 * only and ignores `Accept-Language` — measured 2026-10-15. This is the one
 * source that carries both languages, which is why the API prompt named it.
 */
export interface DoctorSpecialty {
  id: number;
  code?: string;
  name: string;
  name_en?: string;
  name_ar?: string;
  specialty_id?: number;
  has_subspecialties?: boolean;
}

export interface BroadcastPreview {
  total: number;
  /**
   * Per type. Comes back as an empty JSON array rather than an empty object
   * when nothing matches, so it is read through `Object.entries`, which is
   * right either way.
   */
  by_user_type: Record<string, number> | never[];
}

export interface BroadcastRequest {
  title: string;
  body: string;
  /**
   * Optional. A full `http(s)` URL, at most 255 characters; the apps show an
   * "Open link" button for it. The API had no rule for this field as of
   * 2026-10-15 — `not-a-url` and a 270-character link both passed while the
   * request failed on another field — so until that ships, the check in the
   * form is the only one there is.
   */
  link?: string | null;
  target_audience: BroadcastTarget;
}

export interface BroadcastResponse {
  id: number;
  title: string;
  body: string;
  /** `null` when none was sent; absent entirely on a broadcast stored before
   *  the field existed, which is every row on production today. */
  link?: string | null;
  target_audience: BroadcastTarget;
  queued_recipients: number;
  sent_by: number;
  sent_at: string;
}

/**
 * A notification's `link` is an API path — `/admin/doctors/6` — and the
 * dashboard has no `/admin` route at all, so following one landed on the
 * wildcard and redirected to the dashboard home. Every link points at an
 * account, and the one screen that opens an account by any of these ids is the
 * activity timeline, which needs to be told which table the id belongs to.
 *
 * The API's own segment names are the keys, `medical-insurance` included —
 * that is what it sends, even though this dashboard calls the same thing
 * medical issuance.
 */
const LINK_ID_TYPE: Record<string, 'user' | 'organization' | 'facility' | 'doctor'> = {
  patients: 'user',
  tourists: 'user',
  doctors: 'doctor',
  hospitals: 'organization',
  clinics: 'organization',
  pharmacies: 'facility',
  labs: 'facility',
  'medical-insurance': 'facility',
  'medical-issuance': 'facility',
  'home-care': 'facility',
  'physical-therapy': 'facility',
  'employment-offices': 'facility',
  'medical-devices': 'facility'
};

/** API segments that have a dashboard screen of their own, not an account. */
const LINK_DIRECT_ROUTE: Record<string, string> = {
  'external-device-orders': '/dashboard/internal-devices/orders'
};

/**
 * Where a notification should actually open, or null when there is nowhere to
 * go. Null is deliberate: staying put beats redirecting to the dashboard home,
 * which is what made a notification look like it did nothing.
 */
export function notificationTarget(link: string | null | undefined): string | null {
  if (!link) return null;
  // Already a dashboard route — pass it through, so this keeps working if the
  // backend starts sending real routes.
  if (link.startsWith('/dashboard/')) return link;

  const m = /^\/admin\/([a-z-]+)\/(\d+)$/.exec(link);
  if (!m) return null;

  // Not every link points at an account. An order has a screen of its own,
  // and sending it to the buyer's activity timeline would answer a different
  // question than the one the notification asked.
  const direct = LINK_DIRECT_ROUTE[m[1]];
  if (direct) return `${direct}/${m[2]}`;

  const idType = LINK_ID_TYPE[m[1]];
  if (!idType) return null;

  // Patients and tourists are listed by user id, so the endpoint infers it;
  // everything else has to say which table the id came from.
  const query = idType === 'user' ? '' : `?id_type=${idType}`;
  return `/dashboard/users/${m[2]}/activity${query}`;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private api = inject(ApiService);

  list(params: {
    category?: NotificationCategory;
    unread_only?: boolean;
    page?: number;
    per_page?: number;
  } = {}): Observable<PagedResult<SystemNotification>> {
    return this.api.getPaged<SystemNotification>('/admin/notifications/system', params);
  }

  unreadCount(): Observable<UnreadCount> {
    return this.api.get<UnreadCount>('/admin/notifications/system/unread-count');
  }

  markRead(id: number): Observable<{ id: number; unread: boolean }> {
    return this.api.patch<{ id: number; unread: boolean }>(
      `/admin/notifications/system/${id}/read`,
      {}
    );
  }

  markAllRead(category?: NotificationCategory): Observable<{ marked_read: number }> {
    const qs = category ? `?category=${category}` : '';
    return this.api.patch<{ marked_read: number }>(
      `/admin/notifications/system/mark-all-read${qs}`,
      {}
    );
  }

  broadcast(body: BroadcastRequest): Observable<BroadcastResponse> {
    return this.api.post<BroadcastResponse>('/admin/notifications/broadcast', body);
  }

  specialties(): Observable<DoctorSpecialty[]> {
    return this.api.get<DoctorSpecialty[]>('/doctor/specialties');
  }

  subspecialties(specialtyId: number): Observable<DoctorSpecialty[]> {
    return this.api.get<DoctorSpecialty[]>(`/doctor/specialties/${specialtyId}/subspecialties`);
  }

  /**
   * The count a send would reach, before sending. Same rules and same query as
   * the broadcast itself, so the number shown is the number delivered. Sends
   * nothing.
   */
  broadcastPreview(target: BroadcastTarget): Observable<BroadcastPreview> {
    return this.api.post<BroadcastPreview>(
      '/admin/notifications/broadcast/preview',
      { target_audience: target }
    );
  }

  broadcastHistory(query: { page?: number; per_page?: number } = {}): Observable<PagedResult<BroadcastResponse>> {
    return this.api.getPaged<BroadcastResponse>('/admin/notifications/broadcast/history', query);
  }
}
