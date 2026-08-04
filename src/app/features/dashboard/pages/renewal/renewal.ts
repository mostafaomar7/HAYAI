import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RenewalItem, SubscriptionsService } from '../../../../core/services/subscriptions.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { LookupItem, LookupsService } from '../../../../core/services/lookups.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-renewal',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './renewal.html',
  styleUrl: './renewal.css'
})
export class Renewal {
  private svc = inject(SubscriptionsService);
  private dialog = inject(DialogService);
  private plans = inject(PlansService);
  private lookups = inject(LookupsService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  userTypeFilter = signal('');
  planFilter = signal('');
  renewalUsers = signal<RenewalItem[]>([]);
  selectedIds = signal<Set<number>>(new Set());

  readonly perPage = 15;
  page = signal(1);
  total = signal(0);

  plansList = signal<Plan[]>([]);
  userTypes = signal<LookupItem[]>([]);

  // Fallback if /lookups/user-types fails — these are the provider types that have subscriptions.
  readonly defaultUserTypes: LookupItem[] = [
    { id: 'doctor', label: 'Doctor' },
    { id: 'hospital', label: 'Hospital' },
    { id: 'clinic', label: 'Clinic' },
    { id: 'pharmacy', label: 'Pharmacy' },
    { id: 'lab', label: 'Lab / Radiology' },
    { id: 'medical_issuance', label: 'Medical Issuance' },
    { id: 'home_care', label: 'Home Care' },
    { id: 'physical_therapy', label: 'Physical Therapy' },
    { id: 'employment_office', label: 'Employment Office' },
    { id: 'medical_devices', label: 'Medical Devices' }
  ];

  constructor() {
    this.load();
    this.plans.list({ per_page: 100 }).subscribe({
      next: r => this.plansList.set(r.items),
      error: () => this.plansList.set([])
    });
    this.lookups.userTypes().subscribe({
      next: items => {
        // exclude patient/tourist (they don't have plans)
        const filtered = items.filter(i => !['patient', 'tourist'].includes(String(i.id)));
        this.userTypes.set(filtered.length ? filtered : this.defaultUserTypes);
      },
      error: () => this.userTypes.set(this.defaultUserTypes)
    });
  }

  load() {
    this.loading.set(true);
    this.svc.renewals({
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      user_type: this.userTypeFilter() || undefined,
      plan_id: this.planFilter() ? Number(this.planFilter()) : undefined
    }).subscribe({
      next: r => {
        // Renewing the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.renewalUsers.set(r.items);
        this.total.set(r.pagination.total);
        this.selectedIds.set(new Set());
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Search and filters change the result set — restart from page 1. */
  private reload() { this.page.set(1); this.load(); }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.reload();
  });

  toggleFilter() { this.showFilter = !this.showFilter; }
  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { /* keep popup open until X */ }

  applyFilters() {
    this.showFilter = false;
    this.reload();
  }

  resetFilters() {
    this.userTypeFilter.set('');
    this.planFilter.set('');
    this.showFilter = false;
    this.reload();
  }

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

  initials(name?: string | null): string {
    if (!name) return '?';
    const cleaned = name.trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }

  avatarColor(name?: string | null): string {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const s = name ?? '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  async renewOne(id: number) {
    const ok = await this.dialog.confirm({
      title: 'renewal.renew_title',
      icon: 'question',
      confirmText: 'common.renew'
    });
    if (!ok) return;
    this.svc.renew(id).subscribe({
      next: () => { this.dialog.toast('success', 'renewal.renewed'); this.load(); },
      error: err => this.dialog.error('renewal.renew_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  async renewAll() {
    const ids = Array.from(this.selectedIds());
    if (ids.length) {
      const ok = await this.dialog.confirm({
        title: 'renewal.renew_selected_title',
        params: { count: ids.length },
        icon: 'question',
        confirmText: 'renewal.renew_selected'
      });
      if (!ok) return;
      this.svc.renewBulk({ subscription_ids: ids }).subscribe({
        next: r => { this.dialog.toast('success', 'renewal.renewed_count', { count: r.renewed }); this.load(); },
        error: err => this.dialog.error('renewal.bulk_failed', err.error?.message ?? 'dialog.try_again')
      });
    } else {
      const ok = await this.dialog.confirm({
        title: 'renewal.renew_all_title',
        text: 'renewal.renew_all_text',
        icon: 'warning',
        confirmText: 'renewal.renew_all_confirm'
      });
      if (!ok) return;
      this.svc.renewBulk({ all: true }).subscribe({
        next: r => { this.dialog.toast('success', 'renewal.renewed_count', { count: r.renewed }); this.load(); },
        error: err => this.dialog.error('renewal.bulk_failed', err.error?.message ?? 'dialog.try_again')
      });
    }
  }
}
