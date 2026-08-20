import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  Plan,
  PlanModule,
  PlanModuleCatalog,
  PLAN_TYPE_OPTIONS,
  PlansService,
  PlanType
} from '../../../../core/services/plans.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/** One editable line in the card's module picker. */
interface DraftRow {
  key: string;
  label: string;
  included: boolean;
  /** `false` = server never gates it, so it cannot be switched off here. */
  gateable: boolean;
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './plans.html',
  styleUrl: './plans.css'
})
export class Plans {
  private router = inject(Router);
  private svc = inject(PlansService);
  private dialog = inject(DialogService);

  loading = signal(true);
  search = signal('');
  plansList = signal<Plan[]>([]);

  readonly perPage = 12;
  page = signal(1);
  total = signal(0);

  readonly planTypes = PLAN_TYPE_OPTIONS;

  /** '' = every type. Owns `plan_type`; the popup only carries status now. */
  activeType = signal<PlanType | ''>('');

  // ---- filter ----
  showFilter = false;
  statusFilter = signal<string>('');
  activeFilterCount = computed(() => (this.statusFilter() ? 1 : 0));

  // ---- bulk module editor (applies across every plan of the open tab) ----
  showBulk = false;
  bulkCatalog = signal<PlanModuleCatalog[]>([]);
  bulkSelected = signal<string[]>([]);
  bulkSearch = signal('');
  bulkBusy = signal(false);

  /** Modules are scoped per plan type, so a bulk edit needs one type open. */
  canBulkEdit = computed(() => this.activeType() !== '');

  visibleBulk = computed(() => {
    const term = this.bulkSearch().trim().toLowerCase();
    const rows = this.bulkCatalog().filter(c => c.gateable !== false);
    if (!term) return rows;
    return rows.filter(c => `${c.name} ${c.key}`.toLowerCase().includes(term));
  });

  // ---- inline module editing ----
  editingPlanId = signal<number | null>(null);
  draft = signal<DraftRow[]>([]);
  draftSearch = signal('');
  savingModules = signal(false);

  /** Search narrows the picker; the unmatched rows keep their draft state. */
  visibleDraft = computed(() => {
    const term = this.draftSearch().trim().toLowerCase();
    if (!term) return this.draft();
    return this.draft().filter(r => `${r.label} ${r.key}`.toLowerCase().includes(term));
  });
  draftIncluded = computed(() => this.draft().filter(r => r.included).length);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      plan_type: (this.activeType() || undefined) as PlanType | undefined,
      status: (this.statusFilter() || undefined) as 'active' | 'inactive' | undefined
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.plansList.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    // A new search changes the result set — restart from page 1.
    this.page.set(1);
    this.load();
  });

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
    this.showBulk = false;
    this.editingPlanId.set(null);
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeOverlays() {
    this.showFilter = false;
    this.showBulk = false;
    this.editingPlanId.set(null);
  }

  applyFilters() {
    this.showFilter = false;
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.statusFilter.set('');
    this.showFilter = false;
    this.page.set(1);
    this.load();
  }

  /** Switching tabs changes both the result set and which catalog applies. */
  selectType(type: PlanType | '') {
    if (this.activeType() === type) return;
    this.activeType.set(type);
    this.showBulk = false;
    this.bulkSelected.set([]);
    this.bulkCatalog.set([]);
    this.page.set(1);
    this.load();
  }

  toggleBulk(event: Event) {
    event.stopPropagation();
    this.showBulk = !this.showBulk;
    this.showFilter = false;
    this.editingPlanId.set(null);
    const type = this.activeType();
    if (!this.showBulk || !type || this.bulkCatalog().length) return;
    this.svc.modules(type).subscribe({
      next: res => this.bulkCatalog.set(res.items),
      error: () => this.bulkCatalog.set([])
    });
  }

  toggleBulkKey(key: string, event: Event) {
    event.stopPropagation();
    this.bulkSelected.update(keys =>
      keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]
    );
  }

  clearBulk(event: Event) {
    event.stopPropagation();
    this.bulkSelected.set([]);
  }

  /**
   * Applies the picked keys across every plan of the open tab — not just the
   * current page, so all plans of the type are fetched first. Only the picked
   * keys move; everything else on each plan is written back untouched, and
   * always-on rows are never included in the picker to begin with.
   */
  async applyBulk(included: boolean, event: Event) {
    event.stopPropagation();
    const type = this.activeType();
    const keys = this.bulkSelected();
    if (!type || !keys.length) return;

    this.bulkBusy.set(true);
    this.svc.list({ plan_type: type as PlanType, per_page: 100 })
      .pipe(switchMap(async res => {
        const plans = res.items;
        if (!plans.length) return [] as (Plan | null)[];

        const subscribers = plans.reduce((sum, p) => sum + (p.subscribers_count ?? 0), 0);
        const ok = await this.dialog.confirm({
          title: included ? 'plans.bulk_enable_title' : 'plans.bulk_disable_title',
          text: 'plans.bulk_confirm_text',
          params: { modules: keys.length, plans: plans.length, count: subscribers },
          icon: 'warning',
          confirmText: 'common.confirm',
          danger: !included
        });
        if (!ok) return null;

        const picked = new Set(keys);
        const writes = plans.map(p =>
          this.svc.update(p.id, {
            modules: (p.modules ?? []).map(m => ({
              module_key: m.module_key,
              module_name: m.module_name,
              included: m.gateable === false
                ? true
                : (picked.has(m.module_key) ? included : m.included),
              description: m.description ?? null,
              limit: m.supports_limit ? m.limit ?? null : null
            }))
          }).pipe(catchError(() => of(null)))
        );
        return forkJoin(writes).toPromise() as Promise<(Plan | null)[]>;
      }))
      .subscribe({
        next: async results => {
          this.bulkBusy.set(false);
          if (results === null) return; // cancelled at the confirmation
          const list = (await results) ?? [];
          const failed = list.filter(r => r === null).length;
          this.showBulk = false;
          this.bulkSelected.set([]);
          if (failed) {
            this.dialog.error('plans.bulk_partial', 'dialog.try_again');
          } else {
            this.dialog.toast('success', 'plans.bulk_done', { plans: list.length });
          }
          this.load();
        },
        error: () => {
          this.bulkBusy.set(false);
          this.dialog.error('plans.modules_update_failed', 'dialog.try_again');
        }
      });
  }

  /**
   * The catalog now returns every key on every plan, with `included: false`
   * for the ones it does not grant — a hospital plan carries 18 rows. The card
   * shows what the plan gives and counts the rest.
   */
  includedModules(plan: Plan): PlanModule[] {
    return (plan.modules ?? []).filter(m => m.included);
  }

  excludedCount(plan: Plan): number {
    return (plan.modules ?? []).filter(m => !m.included).length;
  }

  private moduleLabel(m: PlanModule): string {
    return m.name || m.module_name || m.module_key;
  }

  /**
   * Opens the picker straight from the card. Everything it needs already rides
   * on `plan.modules` — the server sends `gateable` and `name` per row — so no
   * extra catalog request is needed.
   */
  openModules(plan: Plan, event: Event) {
    event.stopPropagation();
    if (this.editingPlanId() === plan.id) { this.editingPlanId.set(null); return; }
    this.showFilter = false;
    this.showBulk = false;
    this.draftSearch.set('');
    this.draft.set(
      (plan.modules ?? []).map(m => ({
        key: m.module_key,
        label: this.moduleLabel(m),
        // Always-on rows are shown ticked because that is what the server does.
        included: m.gateable === false ? true : m.included,
        gateable: m.gateable !== false
      }))
    );
    this.editingPlanId.set(plan.id);
  }

  toggleDraft(key: string, event: Event) {
    event.stopPropagation();
    this.draft.update(rows =>
      rows.map(r => (r.key === key && r.gateable ? { ...r, included: !r.included } : r))
    );
  }

  setAllDraft(included: boolean, event: Event) {
    event.stopPropagation();
    const visible = new Set(this.visibleDraft().map(r => r.key));
    this.draft.update(rows =>
      rows.map(r => (visible.has(r.key) && r.gateable ? { ...r, included } : r))
    );
  }

  /**
   * Writes the modules back. The update replaces the whole array, so every row
   * is sent — including `limit` and `description`, which this picker does not
   * edit and must not silently drop.
   */
  async saveModules(plan: Plan, event: Event) {
    event.stopPropagation();
    const chosen = new Map(this.draft().map(r => [r.key, r.included]));

    const subscribers = plan.subscribers_count ?? 0;
    if (subscribers > 0) {
      const ok = await this.dialog.confirm({
        title: 'plans.affects_subscribers_title',
        text: 'plans.affects_subscribers_text',
        params: { count: subscribers },
        icon: 'warning',
        confirmText: 'plans.save_changes'
      });
      if (!ok) return;
    }

    this.savingModules.set(true);
    const modules = (plan.modules ?? []).map(m => ({
      module_key: m.module_key,
      module_name: m.module_name,
      included: chosen.get(m.module_key) ?? m.included,
      description: m.description ?? null,
      limit: m.supports_limit ? m.limit ?? null : null
    }));

    this.svc.update(plan.id, { modules }).subscribe({
      next: updated => {
        this.savingModules.set(false);
        this.editingPlanId.set(null);
        // Patch the row in place rather than refetching the whole page.
        this.plansList.update(list =>
          list.map(p => (p.id === plan.id ? { ...p, ...updated, modules: updated?.modules ?? p.modules } : p))
        );
        this.dialog.toast('success', 'plans.modules_updated');
      },
      error: err => {
        this.savingModules.set(false);
        this.dialog.error('plans.modules_update_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  /**
   * Promotes a plan to the fallback for its whole type. On the patient plan
   * that rewrites what every patient account can reach, so it is confirmed with
   * the subscriber count spelled out. The list is refetched afterwards because
   * the previous holder was demoted server-side.
   */
  async setDefault(plan: Plan, event: Event) {
    event.stopPropagation();
    if (plan.is_default) return;

    if (plan.status !== 'active') {
      this.dialog.error('plans.default_needs_active');
      return;
    }

    const ok = await this.dialog.confirm({
      title: 'plans.set_default_title',
      text: plan.plan_type === 'patient' ? 'plans.set_default_patient_text' : 'plans.set_default_text',
      params: { name: plan.name, count: plan.subscribers_count ?? 0 },
      icon: 'warning',
      confirmText: 'plans.set_default_confirm'
    });
    if (!ok) return;

    this.svc.setDefault(plan.id).subscribe({
      next: () => { this.dialog.toast('success', 'plans.default_updated'); this.load(); },
      // 422 when the plan is inactive — the message names the reason.
      error: err => this.dialog.error('plans.default_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  goToDetails(id: number) {
    this.router.navigate(['/dashboard/plans/details', id]);
  }

  goToAdd() {
    this.router.navigate(['/dashboard/plans/add']);
  }
}
