import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BroadcastResponse, NotificationsService } from '../../../../core/services/notifications.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-notification-history',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './notification-history.html',
  styleUrl: './notification-history.css'
})
export class NotificationHistory {
  private svc = inject(NotificationsService);
  private i18n = inject(I18nService);

  loading = signal(true);
  items = signal<BroadcastResponse[]>([]);
  total = signal(0);

  readonly perPage = 15;
  page = signal(1);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.broadcastHistory({ page: this.page(), per_page: this.perPage }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  audienceLabel(t: BroadcastResponse['target_audience']): string {
    if (!t) return '—';
    if (t.type === 'all') return this.i18n.translate('notif.history.audience_all');
    if (t.type === 'user_type') return (t.userTypes ?? []).join(', ') || 'user_type';
    return t.type;
  }
}
