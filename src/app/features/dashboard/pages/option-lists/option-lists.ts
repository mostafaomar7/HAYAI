import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  OPTION_LISTS,
  OptionListConfig,
  OptionListKey,
  OptionListsService,
  OptionRow
} from '../../../../core/services/option-lists.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/** The editable state of one row while the drawer is open. */
interface Draft {
  id: number | null;
  name: string;
  name_en: string;
  name_ar: string;
  sort_order: string;
  is_active: boolean;
  is_other_option: boolean;
  marketplace_provider_id: string;
  code: string;
  parents: Record<string, string>;
  logo: File | null;
  logoUrl: string | null;
  clearLogo: boolean;
}

@Component({
  selector: 'app-option-lists',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './option-lists.html',
  styleUrl: './option-lists.css'
})
export class OptionLists {
  private route = inject(ActivatedRoute);
  private svc = inject(OptionListsService);
  private dialog = inject(DialogService);
  // The dialog translates the strings it is given, but this screen assembles the
  // in-use message from several rows first — each line is translated here.
  private i18n = inject(I18nService);

  config = signal<OptionListConfig>(OPTION_LISTS['icu-specialty-groups']);

  loading = signal(true);
  rows = signal<OptionRow[]>([]);
  total = signal(0);
  readonly perPage = 25;
  page = signal(1);
  search = signal('');
  /** '' = both. Only shown on the lists that carry `is_active`. */
  activeFilter = signal<string>('');

  /** Parent field → chosen id, used both as a table filter and a form default. */
  parentFilter = signal<Record<string, string>>({});
  /** Parent field → the rows to choose from, fetched unpaginated. */
  parentOptions = signal<Record<string, OptionRow[]>>({});

  // ---- drawer ----
  drawerOpen = signal(false);
  saving = signal(false);
  draft = signal<Draft | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  isEdit = computed(() => this.draft()?.id !== null && this.draft()?.id !== undefined);

  constructor() {
    // One component serves all seven routes, so the key has to be watched
    // rather than read once — Angular reuses the instance between them. It
    // comes from route `data` rather than a path param so each list can also
    // carry its own navbar title.
    this.route.data.pipe(takeUntilDestroyed()).subscribe(data => {
      const key = data['listKey'] as OptionListKey | undefined;
      const config = key ? OPTION_LISTS[key] : undefined;
      if (!config) return;
      this.config.set(config);
      this.resetView();
      this.loadParents(config);
      this.load();
    });
  }

  private resetView() {
    this.page.set(1);
    this.search.set('');
    this.activeFilter.set('');
    this.parentFilter.set({});
    this.parentOptions.set({});
    this.rows.set([]);
    this.closeDrawer();
  }

  // ================= list =================

  load() {
    const config = this.config();
    this.loading.set(true);
    this.svc.list(config, {
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      // Sent as 1/0 — a retired row is still a row, so "both" is the default.
      is_active: this.activeFilter() === '' ? undefined : this.activeFilter(),
      ...this.activeParentFilters()
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.rows.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => { this.rows.set([]); this.loading.set(false); }
    });
  }

  private activeParentFilters(): Record<string, string> {
    return Object.entries(this.parentFilter()).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v) acc[k] = v;
      return acc;
    }, {});
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.load();
  });

  setActiveFilter(value: string) {
    this.activeFilter.set(value);
    this.page.set(1);
    this.load();
  }

  setParentFilter(field: string, value: string) {
    this.parentFilter.update(f => ({ ...f, [field]: value }));
    // A child select scoped to this parent no longer matches — clear it.
    for (const parent of this.config().parents) {
      if (parent.filteredBy === field) {
        this.parentFilter.update(f => ({ ...f, [parent.field]: '' }));
      }
    }
    this.page.set(1);
    this.load();
  }

  // ================= parent selects =================

  /** Fills every parent select. `per_page=all` — a select must show everything. */
  private loadParents(config: OptionListConfig) {
    for (const parent of config.parents) {
      this.svc.all(OPTION_LISTS[parent.from]).subscribe({
        next: r => this.parentOptions.update(o => ({ ...o, [parent.field]: r.items })),
        error: () => this.parentOptions.update(o => ({ ...o, [parent.field]: [] }))
      });
    }
  }

  /**
   * Choices for one parent select. A select declared `filteredBy` another is
   * narrowed to the chosen parent — the backend rejects a category from a
   * different group with a 422, so offering one at all is a trap.
   */
  optionsFor(field: string, scope: Record<string, string>): OptionRow[] {
    const parent = this.config().parents.find(p => p.field === field);
    const all = this.parentOptions()[field] ?? [];
    if (!parent?.filteredBy) return all;
    const parentId = scope[parent.filteredBy];
    if (!parentId) return all;
    return all.filter(row => String(row[parent.filteredBy!]) === parentId);
  }

  /**
   * Whether an option is the chosen one. A `[value]` binding on the `<select>`
   * is applied before `@for` has produced any `<option>`, so the assignment is
   * dropped and the control renders blank — marking the option itself is the
   * binding that survives. Select values are strings, row ids are numbers.
   */
  isChosen(value: string | undefined, id: number): boolean {
    return !!value && Number(value) === id;
  }

  // ================= drawer =================

  openCreate() {
    const config = this.config();
    this.fieldErrors.set({});
    this.formError.set(null);
    this.draft.set({
      id: null,
      name: '',
      name_en: '',
      name_ar: '',
      sort_order: '',
      // Rows ship usable; retiring one is the deliberate action.
      is_active: true,
      is_other_option: false,
      marketplace_provider_id: '',
      code: '',
      // Seed from whatever the table is filtered by — that is almost always
      // the parent the admin is adding under.
      parents: config.parents.reduce<Record<string, string>>((acc, p) => {
        acc[p.field] = this.parentFilter()[p.field] ?? '';
        return acc;
      }, {}),
      logo: null,
      logoUrl: null,
      clearLogo: false
    });
    this.drawerOpen.set(true);
  }

  openEdit(row: OptionRow) {
    const config = this.config();
    this.fieldErrors.set({});
    this.formError.set(null);
    this.draft.set({
      id: row.id,
      name: row.name ?? '',
      name_en: row.name_en ?? '',
      name_ar: row.name_ar ?? '',
      sort_order: row.sort_order === undefined || row.sort_order === null ? '' : String(row.sort_order),
      is_active: row.is_active !== false,
      is_other_option: row.is_other_option === true,
      marketplace_provider_id:
        row.marketplace_provider_id === null || row.marketplace_provider_id === undefined
          ? ''
          : String(row.marketplace_provider_id),
      code: row.code ?? '',
      parents: config.parents.reduce<Record<string, string>>((acc, p) => {
        const value = row[p.field];
        acc[p.field] = value === null || value === undefined ? '' : String(value);
        return acc;
      }, {}),
      logo: null,
      logoUrl: row.logo_url ?? null,
      clearLogo: false
    });
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.draft.set(null);
    this.saving.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.drawerOpen()) this.closeDrawer(); }

  patchDraft(patch: Partial<Draft>) {
    const current = this.draft();
    if (current) this.draft.set({ ...current, ...patch });
  }

  setDraftParent(field: string, value: string) {
    const current = this.draft();
    if (!current) return;
    const parents = { ...current.parents, [field]: value };
    // Same rule as the filters: a child scoped to this parent is now invalid.
    for (const parent of this.config().parents) {
      if (parent.filteredBy === field) parents[parent.field] = '';
    }
    this.draft.set({ ...current, parents });
  }

  onLogoPicked(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.patchDraft({ logo: file, clearLogo: false });
  }

  removeLogo() {
    this.patchDraft({ logo: null, logoUrl: null, clearLogo: true });
  }

  save() {
    const config = this.config();
    const draft = this.draft();
    if (!draft) return;

    const errors: Record<string, string> = {};
    if (config.bilingual) {
      if (!draft.name_en.trim()) errors['name_en'] = 'lists.name_en_required';
      if (!draft.name_ar.trim()) errors['name_ar'] = 'lists.name_ar_required';
    } else if (!draft.name.trim()) {
      errors['name'] = 'lists.name_required';
    }
    for (const parent of config.parents) {
      if (!draft.parents[parent.field]) errors[parent.field] = 'lists.parent_required';
    }
    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      return;
    }

    this.fieldErrors.set({});
    this.formError.set(null);
    this.saving.set(true);

    const body = config.hasLogo ? this.buildForm(config, draft) : this.buildJson(config, draft);
    const req$ = draft.id === null
      ? this.svc.create(config, body)
      : this.svc.update(config, draft.id, body);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDrawer();
        this.dialog.toast('success', 'lists.saved');
        // `is_other_option` silently clears on the previous holder, so the
        // whole list is refetched rather than patched in place.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.applyServerErrors(err);
      }
    });
  }

  /**
   * `sort_order` is omitted when blank on purpose — the backend appends the row
   * at `max + 1`, which is what "no opinion" should mean.
   */
  private buildJson(config: OptionListConfig, draft: Draft): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (config.bilingual) {
      body['name_en'] = draft.name_en.trim();
      body['name_ar'] = draft.name_ar.trim();
    } else {
      body['name'] = draft.name.trim();
    }
    for (const parent of config.parents) body[parent.field] = Number(draft.parents[parent.field]);
    if (config.hasSortOrder && draft.sort_order.trim() !== '') {
      body['sort_order'] = Number(draft.sort_order);
    }
    if (config.hasIsActive) body['is_active'] = draft.is_active;
    if (config.hasIsOtherOption) body['is_other_option'] = draft.is_other_option;
    // `code` is generated once from `name_en` and immutable — sending it is a 422.
    return body;
  }

  private buildForm(config: OptionListConfig, draft: Draft): FormData {
    const form = new FormData();
    if (config.bilingual) {
      form.append('name_en', draft.name_en.trim());
      form.append('name_ar', draft.name_ar.trim());
    } else {
      form.append('name', draft.name.trim());
    }
    for (const parent of config.parents) form.append(parent.field, draft.parents[parent.field]);
    if (config.hasSortOrder && draft.sort_order.trim() !== '') {
      form.append('sort_order', draft.sort_order);
    }
    // Multipart carries strings; the backend coerces these two back to booleans.
    if (config.hasIsActive) form.append('is_active', draft.is_active ? 'true' : 'false');
    if (draft.marketplace_provider_id.trim() !== '') {
      form.append('marketplace_provider_id', draft.marketplace_provider_id.trim());
    }
    if (draft.logo) form.append('logo', draft.logo);
    // Only sent when the admin actually removed one — an absent `logo` key
    // means "keep the current file", which is the common case.
    if (draft.clearLogo && !draft.logo) form.append('clear_logo', 'true');
    return form;
  }

  /** Maps a 422 onto the fields it names; anything else becomes a banner. */
  private applyServerErrors(err: HttpErrorResponse) {
    const errors = err.error?.errors as Record<string, unknown> | undefined;
    if (err.status === 422 && errors) {
      const mapped = Object.entries(errors).reduce<Record<string, string>>((acc, [field, messages]) => {
        acc[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        return acc;
      }, {});
      this.fieldErrors.set(mapped);
      if (!Object.keys(mapped).length) this.formError.set(err.error?.message ?? 'dialog.try_again');
      return;
    }
    this.formError.set(err.error?.message ?? 'dialog.try_again');
  }

  // ================= delete =================

  /** The `other` team role is the forms' fallback — the backend refuses it too. */
  canDelete(row: OptionRow): boolean {
    const protectedCode = this.config().protectedCode;
    return !protectedCode || row.code !== protectedCode;
  }

  async remove(row: OptionRow) {
    const config = this.config();
    const ok = await this.dialog.confirm({
      title: 'lists.delete_title',
      text: 'lists.delete_text',
      params: { name: row.name },
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;

    this.svc.delete(config, row.id).subscribe({
      next: () => { this.dialog.toast('success', 'lists.deleted'); this.load(); },
      error: (err: HttpErrorResponse) => this.handleDeleteRefusal(config, row, err)
    });
  }

  /**
   * A row a provider already selected cannot be deleted; the 422 names each
   * usage. Where the row can be retired instead, that is offered right here —
   * it drops out of every picker while the providers holding it keep rendering.
   */
  private async handleDeleteRefusal(config: OptionListConfig, row: OptionRow, err: HttpErrorResponse) {
    const inUse = err.status === 422 ? (err.error?.errors?.in_use as Record<string, number> | undefined) : undefined;
    if (!inUse) {
      this.dialog.error('lists.delete_failed', err.error?.message ?? 'dialog.try_again');
      return;
    }

    const usage = Object.entries(inUse)
      .map(([label, count]) => this.i18n.translate('lists.in_use_entry', { count, label }))
      .join('\n');

    if (!config.offerDeactivate || row.is_active === false) {
      this.dialog.error('lists.in_use_title', usage);
      return;
    }

    const ok = await this.dialog.confirm({
      title: 'lists.in_use_title',
      text: usage,
      icon: 'warning',
      confirmText: 'lists.deactivate_instead'
    });
    if (!ok) return;
    this.setActive(row, false);
  }

  setActive(row: OptionRow, isActive: boolean) {
    this.svc.setActive(this.config(), row.id, isActive).subscribe({
      next: () => { this.dialog.toast('success', 'lists.saved'); this.load(); },
      error: err => this.dialog.error('lists.save_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  // ================= table helpers =================

  /** The first roll-up the row actually carries, e.g. "12 categories". */
  countFor(row: OptionRow): number | null {
    for (const field of this.config().countFields ?? []) {
      const value = row[field];
      if (typeof value === 'number') return value;
    }
    return null;
  }

  /** Parent name for the table, preferring the expanded object over the id. */
  parentName(row: OptionRow, field: string): string {
    const expanded =
      field === 'specialty_group_id' ? row.group :
      field === 'specialty_category_id' ? row.category :
      field === 'specialty_id' ? row.specialty : null;
    if (expanded?.name) return expanded.name;
    const id = row[field];
    if (id === null || id === undefined) return '—';
    return String(
      (this.parentOptions()[field] ?? []).find(o => o.id === Number(id))?.name ?? id
    );
  }

  /** Column count for the loading / empty rows. */
  columnCount = computed(() => {
    const config = this.config();
    return 2 // name + actions
      + (config.bilingual ? 2 : 0)
      + config.parents.length
      + (config.countFields?.length ? 1 : 0)
      + (config.hasSortOrder ? 1 : 0)
      + (config.hasReadonlyCode ? 1 : 0)
      + (config.hasIsActive ? 1 : 0)
      + (config.hasLogo ? 1 : 0)
      + (config.hasIsOtherOption ? 1 : 0);
  });
}
