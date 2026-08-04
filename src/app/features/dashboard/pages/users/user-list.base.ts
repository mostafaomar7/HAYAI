import { DestroyRef, Directive, HostListener, NgZone, inject, signal } from '@angular/core';
import {
  AccountStatus,
  ApprovalStatus,
  BlockableResource,
  UserListQuery,
  UserResource,
  UsersService
} from '../../../../core/services/users.service';
import { APPROVAL_GROUP, ApprovalsService, approvalStatusKey } from '../../../../core/services/approvals.service';
import { PagedResult } from '../../../../core/services/api.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { debounce } from '../../../../shared/utils/debounce.util';

@Directive()
export abstract class UserListBase<T extends { id: number }> {
  abstract resource: UserResource;

  protected svc = inject(UsersService);
  protected approvals = inject(ApprovalsService);
  protected dialog = inject(DialogService);
  protected plans = inject(PlansService);

  loading = signal(true);
  openActionMenuId: number | null = null;
  showFilter = false;

  /**
   * Viewport coordinates for the open row menu. The menu lives inside
   * `.table-responsive`, which scrolls horizontally, so an absolutely positioned
   * menu gets clipped by that scroll container. Rendering it `position: fixed`
   * at the button's coordinates takes it out of the clip entirely.
   */
  menuPos = { top: 0, left: 0, flip: false };

  /** `undefined` for patients/tourists — they have no approval lifecycle. */
  protected get approvalGroup() { return APPROVAL_GROUP[this.resource]; }

  search = signal('');
  /** Patients/tourists: account status. Providers: approval lifecycle. */
  statusFilter = signal<string>('');
  /** Providers only — the login flag. */
  accountStatusFilter = signal<string>('');
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

  readonly perPage = 15;
  page = signal(1);

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
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      account_status: this.accountStatusFilter() || undefined,
      plan_id: this.planFilter() ? Number(this.planFilter()) : undefined,
      governate: this.governateFilter() || undefined,
      gender: this.genderFilter() || undefined,
      doctor_role_id: this.roleFilter() ? Number(this.roleFilter()) : undefined,
      specialty_id: this.specialtyFilter() ? Number(this.specialtyFilter()) : undefined,
      subspecialty_id: this.subspecialtyFilter() ? Number(this.subspecialtyFilter()) : undefined
    };
    this.svc.list<T>(this.resource, query).subscribe({
      next: (r: PagedResult<T>) => {
        // Blocking/removing the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Search and filters change the result set — restart from page 1. */
  protected reload() { this.page.set(1); this.load(); }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.reload();
  });

  toggleActionMenu(id: number, event: Event) {
    event.stopPropagation();
    this.openActionMenuId = this.openActionMenuId === id ? null : id;
    this.showFilter = false;
    if (this.openActionMenuId !== null) this.positionMenu(event.currentTarget as HTMLElement | null);
  }

  /**
   * Anchors the menu to the trigger button in viewport space. `left` is the
   * button's inline-end edge and the menu is pulled back by its own width in
   * CSS, so the two edges line up without needing to measure the menu. Near the
   * bottom of the viewport it opens upwards instead — a fixed element cannot be
   * scrolled into view.
   */
  private positionMenu(trigger: HTMLElement | null) {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    // Tallest menu in these lists is 4 items ≈ 170px; 200px keeps a margin.
    const flip = rect.bottom + 200 > window.innerHeight;
    // `min-width: 140px` on the menu — keep both its edges on screen.
    const MIN_W = 148;
    const anchor = rtl ? rect.left : rect.right;
    const left = rtl
      ? Math.min(anchor, window.innerWidth - MIN_W)
      : Math.max(anchor, MIN_W);
    this.menuPos = { top: flip ? rect.top - 4 : rect.bottom + 4, left, flip };
  }

  @HostListener('window:resize')
  closeActionMenu() { this.openActionMenuId = null; }

  /**
   * A fixed menu does not travel with its row, so any scroll has to dismiss it.
   * The page scrolls in the shell's `.dashboard-content`, not on the window, and
   * scroll events do not bubble — hence a capture-phase listener on `document`,
   * which also covers the table's own horizontal scroller. It is registered
   * outside Angular so ordinary scrolling costs nothing; it only re-enters to
   * close an open menu.
   */
  private readonly scrollDismiss = ((): void => {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    const onScroll = () => {
      if (this.openActionMenuId === null) return;
      zone.run(() => (this.openActionMenuId = null));
    };
    zone.runOutsideAngular(() => document.addEventListener('scroll', onScroll, true));
    destroyRef.onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  })();

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

  /**
   * Blocks a provider's account. Same enforcement as blocking a patient —
   * tokens are revoked and the session ends immediately — so it is confirmed
   * first. Approval state (`status`) is untouched.
   */
  async blockProvider(id: number) {
    this.openActionMenuId = null;
    const ok = await this.dialog.confirm({
      title: 'users.block_title',
      text: 'users.block_text',
      icon: 'warning',
      confirmText: 'users.actions.block_account',
      danger: true
    });
    if (!ok) return;
    this.setAccountStatus(id, 'blocked');
  }

  unblockProvider(id: number) {
    this.openActionMenuId = null;
    this.setAccountStatus(id, 'active');
  }

  private setAccountStatus(id: number, status: AccountStatus) {
    this.svc.setStatus(this.resource, id, status).subscribe({
      next: res => {
        this.patchRow(id, { account_status: res?.account_status ?? status });
        this.dialog.toast('success', status === 'blocked' ? 'users.blocked_toast' : 'users.unblocked_toast');
      },
      error: err => this.dialog.error('users.status_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /**
   * Blocking force-signs-out the account, so it is confirmed first. Only
   * patients and tourists expose these endpoints.
   */
  async blockUser(id: number) {
    const resource = this.blockableResource();
    if (!resource) return;
    this.openActionMenuId = null;
    const ok = await this.dialog.confirm({
      title: 'users.block_title',
      text: 'users.block_text',
      icon: 'warning',
      confirmText: 'users.actions.block',
      danger: true
    });
    if (!ok) return;
    this.svc.block(resource, id).subscribe({
      next: res => {
        this.patchRow(id, { status: res?.status ?? 'blocked' });
        this.dialog.toast('success', 'users.blocked_toast');
      },
      error: err => this.dialog.error('users.status_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  unblockUser(id: number) {
    const resource = this.blockableResource();
    if (!resource) return;
    this.openActionMenuId = null;
    this.svc.unblock(resource, id).subscribe({
      next: res => {
        this.patchRow(id, { status: res?.status ?? 'active' });
        this.dialog.toast('success', 'users.unblocked_toast');
      },
      error: err => this.dialog.error('users.status_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /**
   * Only patients and tourists have the dedicated block/unblock endpoints.
   * Providers go through `PATCH /status` instead — same enforcement.
   */
  private blockableResource(): BlockableResource | null {
    return this.resource === 'patients' || this.resource === 'tourists' ? this.resource : null;
  }

  /**
   * Writes what the backend reported onto the row in place. Patients and
   * tourists carry the login flag in `status`; providers in `account_status`.
   */
  private patchRow(id: number, patch: Partial<Record<'status' | 'account_status', AccountStatus>>) {
    this.items.update(list =>
      list.map(u => (u.id === id ? { ...u, ...patch } as T : u))
    );
  }

  async approve(id: number) {
    const group = this.approvalGroup;
    if (!group) return;
    this.openActionMenuId = null;

    const ok = await this.dialog.confirm({
      title: 'approval.approve_title',
      icon: 'question',
      confirmText: 'common.approve'
    });
    if (!ok) return;

    this.approvals.approve(group, id).subscribe({
      next: () => { this.dialog.toast('success', 'approval.approve_success'); this.load(); },
      // 422 carries "Only pending facilities can be approved." — surface it.
      error: err => this.dialog.error('approval.approve_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  async reject(id: number) {
    const group = this.approvalGroup;
    if (!group) return;
    this.openActionMenuId = null;

    const reason = await this.dialog.prompt({
      title: 'approval.reject_title',
      text: 'approval.reject_text',
      placeholder: 'approval.reject_placeholder',
      inputType: 'textarea',
      confirmText: 'common.reject'
    });
    if (reason === null) return;
    if (!reason.trim()) {
      this.dialog.error('approval.reason_required');
      return;
    }

    this.approvals.reject(group, id, reason.trim()).subscribe({
      next: () => { this.dialog.toast('success', 'approval.reject_success'); this.load(); },
      error: err => this.dialog.error('approval.reject_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /** i18n key for a provider's approval badge. */
  approvalLabel(status: ApprovalStatus | null | undefined): string {
    return approvalStatusKey(status);
  }

  async changePlan(id: number) {
    this.openActionMenuId = null;

    // Plans are already fetched in `init()` — reuse them instead of refetching.
    const options = this.plansList().reduce<Record<string, string>>((acc, p) => {
      acc[String(p.id)] = `${p.name} — ${p.plan_type}`;
      return acc;
    }, {});

    if (!Object.keys(options).length) {
      this.dialog.info('users.no_plans', 'users.no_plans_text');
      return;
    }

    const choice = await this.dialog.select({
      title: 'users.change_plan_title',
      options,
      placeholder: 'users.select_plan',
      confirmText: 'common.update'
    });
    if (!choice) return;

    this.svc.setPlan(this.resource, id, Number(choice)).subscribe({
      next: () => { this.dialog.toast('success', 'users.plan_updated'); this.load(); },
      error: err => this.dialog.error('users.plan_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  applyFilters() {
    this.showFilter = false;
    this.reload();
  }

  resetFilters() {
    this.statusFilter.set('');
    this.accountStatusFilter.set('');
    this.planFilter.set('');
    this.governateFilter.set('');
    this.genderFilter.set('');
    this.roleFilter.set('');
    this.specialtyFilter.set('');
    this.subspecialtyFilter.set('');
    this.showFilter = false;
    this.reload();
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
