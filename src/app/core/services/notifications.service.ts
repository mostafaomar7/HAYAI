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
