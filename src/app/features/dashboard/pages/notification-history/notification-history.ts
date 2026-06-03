import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BroadcastResponse, NotificationsService } from '../../../../core/services/notifications.service';

@Component({
  selector: 'app-notification-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-history.html',
  styleUrl: './notification-history.css'
})
export class NotificationHistory {
  private svc = inject(NotificationsService);

  loading = signal(true);
  items = signal<BroadcastResponse[]>([]);
  total = signal(0);
  page = signal(1);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.broadcastHistory({ page: this.page(), per_page: 15 }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  audienceLabel(t: BroadcastResponse['target_audience']): string {
    if (!t) return '—';
    if (t.type === 'all') return 'All users';
    if (t.type === 'user_type') return (t.userTypes ?? []).join(', ') || 'user_type';
    return t.type;
  }
}
