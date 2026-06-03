import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RenewalItem, SubscriptionsService } from '../../../../core/services/subscriptions.service';

@Component({
  selector: 'app-renewal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './renewal.html',
  styleUrl: './renewal.css'
})
export class Renewal {
  private svc = inject(SubscriptionsService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  userTypeFilter = signal('');
  planFilter = signal('');
  renewalUsers = signal<RenewalItem[]>([]);
  selectedIds = signal<Set<number>>(new Set());

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.renewals({
      search: this.search() || undefined,
      user_type: this.userTypeFilter() || undefined,
      plan_id: this.planFilter() ? Number(this.planFilter()) : undefined
    }).subscribe({
      next: r => {
        this.renewalUsers.set(r.items);
        this.selectedIds.set(new Set());
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }
  onUserType(value: string) { this.userTypeFilter.set(value); this.load(); }
  onPlan(value: string) { this.planFilter.set(value); this.load(); }

  toggleFilter() { this.showFilter = !this.showFilter; }
  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { /* leave open until X tapped */ }

  toggleRow(id: number) {
    const set = new Set(this.selectedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.selectedIds.set(set);
  }

  toggleAll(checked: boolean) {
    if (checked) {
      this.selectedIds.set(new Set(this.renewalUsers().map(r => r.id)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  renewOne(id: number) {
    if (!confirm('Renew this subscription?')) return;
    this.svc.renew(id).subscribe(() => this.load());
  }

  renewAll() {
    const ids = Array.from(this.selectedIds());
    if (ids.length) {
      if (!confirm(`Renew ${ids.length} selected?`)) return;
      this.svc.renewBulk({ subscription_ids: ids }).subscribe(() => this.load());
    } else {
      if (!confirm('Renew ALL filtered users?')) return;
      this.svc.renewBulk({ all: true }).subscribe(() => this.load());
    }
  }
}
