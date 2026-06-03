import { Directive, HostListener, inject, signal } from '@angular/core';
import { UserListQuery, UserResource, UsersService } from '../../../../core/services/users.service';
import { PagedResult } from '../../../../core/services/api.service';

@Directive()
export abstract class UserListBase<T extends { id: number }> {
  abstract resource: UserResource;

  protected svc = inject(UsersService);

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

  protected init() { this.load(); }

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
    this.svc.setStatus(this.resource, id, status).subscribe(() => {
      this.openActionMenuId = null;
      this.load();
    });
  }

  changePlan(id: number) {
    const v = prompt('Enter the new plan ID:');
    if (!v) return;
    const planId = Number(v);
    if (!planId) return;
    this.svc.setPlan(this.resource, id, planId).subscribe(() => {
      this.openActionMenuId = null;
      this.load();
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
}
