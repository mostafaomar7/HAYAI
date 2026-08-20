import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ModuleGroup,
  Plan,
  PlanModule,
  PlanModuleCatalog,
  PLAN_TYPE_OPTIONS,
  PlansService,
  PlanType
} from '../../../../core/services/plans.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface ModuleRow {
  module_key: string;
  module_name: string;
  checked: boolean;
  description: string;
  group: string;
  sortOrder: number;
  supportsLimit: boolean;
  limitUnit: string | null;
  /** `false` = the server never gates it, so the toggle would be a lie. */
  gateable: boolean;
  /** Shipped after this plan was last saved — nobody has decided on it yet. */
  isNew: boolean;
  limit: number | null;
}

interface ModuleSection {
  key: string;
  label: string;
  rows: { row: ModuleRow; index: number }[];
  includedCount: number;
  togglableCount: number;
}

/** Fallback bucket when the server predates `group` on the catalog. */
const UNGROUPED = '__ungrouped__';

@Component({
  selector: 'app-plans-add',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './plans-add.html',
  styleUrl: './plans-add.css'
})
export class PlansAdd {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(PlansService);
  private dialog = inject(DialogService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  name = '';
  planType: PlanType | '' = '';
  status: 'active' | 'inactive' = 'active';
  price: number | null = null;
  months: number | null = null;
  discount = 0;
  description = '';
  /** Set from the loaded plan when editing; the backend owns it on create. */
  currency = signal('');
  /** Drives the "this takes effect immediately" warning before saving. */
  subscribersCount = signal(0);

  modules = signal<ModuleRow[]>([]);
  private groups = signal<ModuleGroup[]>([]);
  moduleSearch = signal('');

  /** Shared with the list's tab strip so a new plan type is one edit, not two. */
  readonly planTypes = PLAN_TYPE_OPTIONS;

  /**
   * The catalog runs to ~18 keys per plan type, so it is grouped and
   * searchable. Sections keep the server's order; the search narrows rows and
   * drops sections that end up empty.
   */
  sections = computed<ModuleSection[]>(() => {
    const term = this.moduleSearch().trim().toLowerCase();
    const order = new Map(this.groups().map((g, i) => [g.key, g.sort_order ?? i]));
    const labels = new Map(this.groups().map(g => [g.key, g.label]));

    const byGroup = new Map<string, { row: ModuleRow; index: number }[]>();
    this.modules().forEach((row, index) => {
      if (term && !`${row.module_name} ${row.module_key}`.toLowerCase().includes(term)) return;
      const bucket = byGroup.get(row.group) ?? [];
      bucket.push({ row, index });
      byGroup.set(row.group, bucket);
    });

    return [...byGroup.entries()]
      .map(([key, rows]) => {
        rows.sort((a, b) => a.row.sortOrder - b.row.sortOrder);
        return {
          key,
          label: labels.get(key) ?? (key === UNGROUPED ? '' : key),
          rows,
          includedCount: rows.filter(r => r.row.checked).length,
          togglableCount: rows.filter(r => r.row.gateable).length
        };
      })
      .sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
  });

  newCount = computed(() => this.modules().filter(m => m.isNew).length);
  includedCount = computed(() => this.modules().filter(m => m.checked).length);
  /** True once the server starts sending groups — hides the section chrome otherwise. */
  hasGroups = computed(() => this.groups().length > 0);

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.load(id);
    }
  }

  /** Called from the template whenever the Plan Type dropdown changes. */
  onPlanTypeChange(next: PlanType | '') {
    this.planType = next;
    if (!next) {
      this.modules.set([]);
      this.groups.set([]);
      return;
    }
    // Preserve the admin's choices for keys that survive into the new catalog;
    // drop the rest, since the backend rejects unknown keys.
    const prev = new Map(this.modules().map(m => [m.module_key, m]));
    this.svc.modules(next).subscribe({
      next: res => {
        this.groups.set(res.groups);
        this.modules.set(res.items.map(c => this.toRow(c, undefined, prev.get(c.key))));
      },
      error: () => { this.modules.set([]); this.groups.set([]); }
    });
  }

  /**
   * Builds one editable row. `saved` is the plan's stored state (absent when
   * creating), `carried` is the admin's unsaved choice from a previous type.
   */
  private toRow(c: PlanModuleCatalog, saved?: PlanModule, carried?: ModuleRow): ModuleRow {
    const gateable = c.gateable !== false;
    const checked = !gateable
      ? true // always-on: the server serves it whatever the plan says
      : (saved ? saved.included : carried?.checked ?? c.default_included ?? false);

    return {
      module_key: c.key,
      module_name: c.name,
      checked,
      description: saved?.description ?? carried?.description ?? '',
      group: c.group || c.group_name || UNGROUPED,
      sortOrder: c.sort_order ?? 0,
      supportsLimit: c.supports_limit === true,
      limitUnit: c.limit_unit ?? null,
      gateable,
      isNew: this.isNewerThanSave(c.created_at),
      limit: saved?.limit ?? carried?.limit ?? null
    };
  }

  /** A catalog entry added after this plan was last saved is unreviewed. */
  private savedAt: string | null = null;
  private isNewerThanSave(createdAt?: string | null): boolean {
    if (!createdAt || !this.savedAt || !this.isEdit()) return false;
    const added = Date.parse(createdAt);
    const saved = Date.parse(this.savedAt);
    return Number.isFinite(added) && Number.isFinite(saved) && added > saved;
  }

  private load(id: number) {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: p => {
        this.name = p.name;
        this.planType = p.plan_type;
        this.status = p.status;
        this.price = Number(p.price);
        this.currency.set(p.currency ?? '');
        this.months = p.months;
        this.discount = p.discount;
        this.description = p.description ?? '';
        this.subscribersCount.set(p.subscribers_count ?? 0);
        this.savedAt = p.modules_saved_at ?? null;

        this.svc.modules(p.plan_type).subscribe({
          next: res => {
            this.groups.set(res.groups);
            const saved = new Map((p.modules ?? []).map(m => [m.module_key, m]));
            this.modules.set(res.items.map(c => this.toRow(c, saved.get(c.key))));
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  toggleModule(index: number) {
    const row = this.modules()[index];
    if (!row || !row.gateable) return; // always-on cannot be switched off
    const arr = [...this.modules()];
    arr[index] = { ...row, checked: !row.checked };
    this.modules.set(arr);
  }

  /** Bulk switch for one section — skips always-on rows, which never change. */
  setSection(section: ModuleSection, included: boolean) {
    const targets = new Set(section.rows.filter(r => r.row.gateable).map(r => r.index));
    if (!targets.size) return;
    this.modules.set(
      this.modules().map((row, i) => (targets.has(i) ? { ...row, checked: included } : row))
    );
  }

  updateModuleDescription(index: number, value: string) {
    const arr = [...this.modules()];
    arr[index] = { ...arr[index], description: value };
    this.modules.set(arr);
  }

  updateModuleLimit(index: number, value: string) {
    const parsed = value.trim() === '' ? null : Number(value);
    const arr = [...this.modules()];
    arr[index] = {
      ...arr[index],
      limit: parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null
    };
    this.modules.set(arr);
  }

  onSearch(value: string) { this.moduleSearch.set(value); }

  get checkedModules() { return this.modules().filter(m => m.checked); }

  goBack() { this.location.back(); }

  async save() {
    if (!this.name || !this.planType || this.price === null || this.months === null) {
      this.errorMessage.set('plans.required_fields');
      return;
    }

    // Module changes reach current subscribers the moment this is written —
    // the backend reads the plan's rows live rather than snapshotting them.
    const subscribers = this.subscribersCount();
    if (this.isEdit() && subscribers > 0) {
      const ok = await this.dialog.confirm({
        title: 'plans.affects_subscribers_title',
        // The patient plan is the whole patient base, not a paying cohort.
        text: this.planType === 'patient'
          ? 'plans.affects_patients_text'
          : 'plans.affects_subscribers_text',
        params: { count: subscribers },
        icon: 'warning',
        confirmText: 'plans.save_changes'
      });
      if (!ok) return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: Partial<Plan> = {
      name: this.name,
      plan_type: this.planType as PlanType,
      status: this.status,
      price: this.price ?? 0,
      months: this.months ?? 1,
      discount: this.discount,
      description: this.description,
      modules: this.modules().map(m => ({
        module_key: m.module_key,
        module_name: m.module_name,
        included: m.checked,
        description: m.checked ? m.description : null,
        // Only send a cap where the catalog says one is meaningful.
        limit: m.checked && m.supportsLimit ? m.limit : null
      }))
    };

    const id = this.id();
    const req$ = id ? this.svc.update(id, body) : this.svc.create(body);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/plans']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message ?? 'dialog.try_again');
      }
    });
  }
}
