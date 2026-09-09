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

export interface BroadcastTarget {
  type: 'all' | 'user_type' | 'segment';
  userTypes?: string[];
}

export interface BroadcastRequest {
  title: string;
  body: string;
  target_audience: BroadcastTarget;
}

export interface BroadcastResponse {
  id: number;
  title: string;
  body: string;
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

  broadcastHistory(query: { page?: number; per_page?: number } = {}): Observable<PagedResult<BroadcastResponse>> {
    return this.api.getPaged<BroadcastResponse>('/admin/notifications/broadcast/history', query);
  }
}
