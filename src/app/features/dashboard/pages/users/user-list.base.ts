import { Directive, HostListener, inject, signal } from '@angular/core';
import { UserListQuery, UserResource, UsersService } from '../../../../core/services/users.service';
import { PagedResult } from '../../../../core/services/api.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { Plan, PlansService } from '../../../../core/services/plans.service';

@Directive()
export abstract class UserListBase<T extends { id: number }> {
  abstract resource: UserResource;

  protected svc = inject(UsersService);
  protected dialog = inject(DialogService);
  protected plans = inject(PlansService);

  loading = signal(true);
  openActionMenuId: number | null = null;
  showFilter = false;

  search = signal('');
  statusFilter = signal<string>('');
  planFilter = signal<string>('');
  // patient-only
  governateFilter = signal<string>('');
  genderFilter = signal<string>('');
  // doctor-only
  roleFilter = signal<string>('');
  specialtyFilter = signal<string>('');
  subspecialtyFilter = signal<string>('');

  items = signal<T[]>([]);
  total = signal(0);
  plansList = signal<Plan[]>([]);

  protected init() {
    this.plans.list({ per_page: 100 }).subscribe({
      next: r => this.plansList.set(r.items),
      error: () => this.plansList.set([])
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    const query: UserListQuery = {
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      plan_id: this.planFilter() ? Number(this.planFilter()) : undefined,
      governate: this.governateFilter() || undefined,
      gender: this.genderFilter() || undefined,
      doctor_role_id: this.roleFilter() ? Number(this.roleFilter()) : undefined,
      specialty_id: this.specialtyFilter() ? Number(this.specialtyFilter()) : undefined,
      subspecialty_id: this.subspecialtyFilter() ? Number(this.subspecialtyFilter()) : undefined
    };
    this.svc.list<T>(this.resource, query).subscribe({
      next: (r: PagedResult<T>) => {
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }

  toggleActionMenu(id: number, event: Event) {
    event.stopPropagation();
    this.openActionMenuId = this.openActionMenuId === id ? null : id;
    this.showFilter = false;
  }

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
    this.openActionMenuId = null;
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeDropdowns() {
    this.openActionMenuId = null;
    this.showFilter = false;
  }

  setStatus(id: number, status: 'active' | 'inactive' | 'blocked') {
    this.svc.setStatus<T & { status?: string }>(this.resource, id, status).subscribe({
      next: updated => {
        this.openActionMenuId = null;
        // Backend response is the source of truth — update the row in place
        // instead of refetching the whole list.
        const next = (updated?.status ?? status) as 'active' | 'inactive' | 'blocked';
        this.items.update(list =>
          list.map(u => u.id === id ? { ...u, status: next } as T : u)
        );
        this.dialog.toast('success', this.statusToastLabel(next));
      },
      error: err => this.dialog.error('Status change failed', err.error?.message ?? 'Please try again.')
    });
  }

  private statusToastLabel(s: 'active' | 'inactive' | 'blocked'): string {
    if (s === 'blocked') return 'User blocked';
    if (s === 'inactive') return 'User deactivated';
    return 'User unblocked';
  }

  changePlan(id: number) {
    this.openActionMenuId = null;
    this.plans.list({ per_page: 100 }).subscribe(async r => {
      const options = r.items.reduce<Record<string, string>>((acc, p) => {
        acc[String(p.id)] = `${p.name} — ${p.plan_type}`;
        return acc;
      }, {});

      if (!Object.keys(options).length) {
        this.dialog.info('No plans available', 'Create a plan first.');
        return;
      }

      const SwalCtor = (await import('sweetalert2')).default;
      const result = await SwalCtor.fire({
        title: 'Change plan',
        input: 'select',
        inputOptions: options,
        inputPlaceholder: 'Select a plan',
        showCancelButton: true,
        confirmButtonText: 'Update',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        reverseButtons: true
      });

      if (!result.isConfirmed || !result.value) return;
      const planId = Number(result.value);
      this.svc.setPlan(this.resource, id, planId).subscribe({
        next: () => { this.dialog.toast('success', 'Plan updated'); this.load(); },
        error: err => this.dialog.error('Plan change failed', err.error?.message ?? 'Please try again.')
      });
    });
  }

  applyFilters() {
    this.showFilter = false;
    this.load();
  }

  resetFilters() {
    this.statusFilter.set('');
    this.planFilter.set('');
    this.governateFilter.set('');
    this.genderFilter.set('');
    this.roleFilter.set('');
    this.specialtyFilter.set('');
    this.subspecialtyFilter.set('');
    this.showFilter = false;
    this.load();
  }

  /** First two letters of the name (uppercased). */
  initials(name?: string | null): string {
    if (!name) return '?';
    const cleaned = name.trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }

  /** Deterministic background color from the name. */
  avatarColor(name?: string | null): string {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const s = name ?? '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
}
