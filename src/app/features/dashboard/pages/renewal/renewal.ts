import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RenewalItem, SubscriptionsService } from '../../../../core/services/subscriptions.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { LookupItem, LookupsService } from '../../../../core/services/lookups.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-renewal',
  standalone: true,
  imports: [CommonModule, TPipe],
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

  toggleFilter() { this.showFilter = !this.showFilter; }
  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { /* keep popup open until X */ }

  applyFilters() {
    this.showFilter = false;
    this.load();
  }

  resetFilters() {
    this.userTypeFilter.set('');
    this.planFilter.set('');
    this.showFilter = false;
    this.load();
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
      title: 'Renew subscription?',
      icon: 'question',
      confirmText: 'Renew'
    });
    if (!ok) return;
    this.svc.renew(id).subscribe({
      next: () => { this.dialog.toast('success', 'Subscription renewed'); this.load(); },
      error: err => this.dialog.error('Renew failed', err.error?.message ?? 'Please try again.')
    });
  }

  async renewAll() {
    const ids = Array.from(this.selectedIds());
    if (ids.length) {
      const ok = await this.dialog.confirm({
        title: `Renew ${ids.length} subscription(s)?`,
        icon: 'question',
        confirmText: 'Renew selected'
      });
      if (!ok) return;
      this.svc.renewBulk({ subscription_ids: ids }).subscribe({
        next: r => { this.dialog.toast('success', `Renewed ${r.renewed}`); this.load(); },
        error: err => this.dialog.error('Bulk renew failed', err.error?.message ?? 'Please try again.')
      });
    } else {
      const ok = await this.dialog.confirm({
        title: 'Renew ALL filtered users?',
        text: 'This will renew every subscription matching the current filter.',
        icon: 'warning',
        confirmText: 'Renew all'
      });
      if (!ok) return;
      this.svc.renewBulk({ all: true }).subscribe({
        next: r => { this.dialog.toast('success', `Renewed ${r.renewed}`); this.load(); },
        error: err => this.dialog.error('Bulk renew failed', err.error?.message ?? 'Please try again.')
      });
    }
  }
}
