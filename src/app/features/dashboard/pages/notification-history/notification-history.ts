import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BroadcastResponse,
  NotificationsService,
  USER_TYPE_LABEL
} from '../../../../core/services/notifications.service';
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

  /**
   * What the broadcast was actually aimed at.
   *
   * It used to print the API's raw ids — "patient, pharmacies" — and nothing
   * else. Since a broadcast can now be narrowed by gender and by specialty,
   * leaving those out would make two rows with very different reach look
   * identical here: "Patients" and "Patients" where one went to seven people
   * and the other to nineteen.
   */
  audienceLabel(t: BroadcastResponse['target_audience']): string {
    if (!t) return '—';
    const parts: string[] = [];

    if (t.type === 'all') parts.push(this.i18n.translate('notif.history.audience_all'));
    else if (t.userTypes?.length) parts.push(t.userTypes.map(x => this.typeName(x)).join('، '));
    else if (t.type === 'user_type') parts.push(this.i18n.translate('notif.history.audience_none'));
    else parts.push(t.type);

    for (const g of t.genders ?? []) parts.push(this.i18n.translate(`notif.send.gender.${g}`));
    const narrowed = (t.specialtyIds?.length ?? 0) + (t.subspecialtyIds?.length ?? 0);
    if (narrowed) {
      parts.push(this.i18n.translate('notif.history.specialties', { count: narrowed }));
    }
    return parts.join(' · ');
  }

  private typeName(id: string): string {
    const key = USER_TYPE_LABEL[id];
    if (!key) return id;
    const text = this.i18n.translate(key);
    return text === key ? id : text;
  }
}
