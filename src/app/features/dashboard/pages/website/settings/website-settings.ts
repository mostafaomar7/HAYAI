import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { WebsiteSetting } from '../../../../../core/services/website/website.models';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { fmtDate, lines } from '../shared/website-utils';

/** How one setting is edited. Decided from `type`, then from the value's shape. */
type Widget = 'string' | 'text' | 'bool' | 'number' | 'list' | 'json';

/** Draft values are what the inputs hold: strings for text-ish widgets, booleans for toggles. */
type DraftValue = string | boolean;

/**
 * Settings that publish the in-app provider directory (doctors / hospitals)
 * on the open web. Today those pages are sign-in only; switching one on makes
 * every provider profile crawlable and indexable, so it is confirmed first.
 */
const DIRECTORY_KEYS = ['directory.doctors_public', 'directory.hospitals_public'];

/** Keys whose values are URLs, e-mails or phone numbers — always typed left-to-right. */
const LTR_HINTS = ['url', 'same_as', 'email', 'phone', 'whatsapp', 'twitter'];

/**
 * Website settings (§13.1): organisation identity for structured data, SEO
 * title suffixes, llms.txt header, directory publication, analytics switch,
 * legal links. The backend describes every key (`type`, `default`,
 * `description`), so the form is generated from that list — a new key is a
 * backend change only. Only changed keys are sent, as flat `group.key` pairs.
 */
@Component({
  selector: 'app-website-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './website-settings.html',
  styleUrls: ['../shared/website.shared.css', './website-settings.css']
})
export class WebsiteSettings {
  private api = inject(WebsiteApiService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly ctx = inject(WebsiteContextService);

  rows = signal<WebsiteSetting[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  flushing = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  /** Input state per key, and the same rendered from the server copy to diff against. */
  draft = signal<Record<string, DraftValue>>({});
  private original = signal<Record<string, DraftValue>>({});

  activeGroup = signal<string>('all');

  readonly canEdit = computed(() => this.ctx.can('settings.update'));

  readonly groups = computed(() => {
    const map = new Map<string, WebsiteSetting[]>();
    for (const r of this.rows()) {
      const g = r.group || r.key.split('.')[0] || 'other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  readonly visibleGroups = computed(() => {
    const g = this.activeGroup();
    return g === 'all' ? this.groups() : this.groups().filter(x => x.name === g);
  });

  readonly changedKeys = computed(() => {
    const d = this.draft();
    const o = this.original();
    return Object.keys(d).filter(k => d[k] !== o[k]);
  });

  constructor() {
    // `?group=llms` lets other screens (crawlers → llms.txt) open the right group.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => this.activeGroup.set(q.get('group') || 'all'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.init(rows ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.settings.load_failed'));
        this.loading.set(false);
      }
    });
  }

  private init(rows: WebsiteSetting[]): void {
    this.rows.set(rows);
    const values: Record<string, DraftValue> = {};
    for (const r of rows) values[r.key] = this.toDraft(r, r.value);
    this.original.set(values);
    this.draft.set({ ...values });
    this.errors.set({});
    this.formError.set(null);
  }

  selectGroup(group: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { group: group === 'all' ? null : group }, replaceUrl: true });
  }

  // ── widgets ─────────────────────────────────────────────────────

  widget(row: WebsiteSetting): Widget {
    const type = (row.type || '').toLowerCase();
    const sample = row.value ?? row.default;
    switch (type) {
      case 'string': case 'url': case 'email': return 'string';
      case 'text': return 'text';
      case 'bool': case 'boolean': return 'bool';
      case 'int': case 'integer': case 'float': case 'number': return 'number';
      case 'array': case 'list': case 'json':
        // A list of strings (same_as URLs, area_served) is far easier to edit
        // one per line; anything nested falls back to raw JSON.
        if (sample === null || sample === undefined || this.isStringList(sample)) return 'list';
        return 'json';
    }
    if (typeof sample === 'boolean') return 'bool';
    if (typeof sample === 'number') return 'number';
    if (typeof sample === 'string') return sample.length > 120 ? 'text' : 'string';
    if (this.isStringList(sample)) return 'list';
    return 'json';
  }

  private isStringList(v: unknown): boolean {
    return Array.isArray(v) && v.every(x => typeof x === 'string');
  }

  private toDraft(row: WebsiteSetting, value: unknown): DraftValue {
    switch (this.widget(row)) {
      case 'bool': return value === true || value === 1 || value === '1' || value === 'true';
      case 'list': return Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value);
      case 'json': return value === null || value === undefined ? '' : JSON.stringify(value, null, 2);
      case 'number': return value === null || value === undefined ? '' : String(value);
      default: return value === null || value === undefined ? '' : String(value);
    }
  }

  /** Draft → the JSON value the API expects. Throws on invalid JSON so `save` can flag the field. */
  private fromDraft(row: WebsiteSetting, value: DraftValue): unknown {
    switch (this.widget(row)) {
      case 'bool': return !!value;
      case 'list': return lines(String(value));
      case 'json': {
        const s = String(value).trim();
        return s === '' ? null : JSON.parse(s);
      }
      case 'number': {
        const s = String(value).trim();
        return s === '' ? null : Number(s);
      }
      default: {
        const s = String(value);
        return s.trim() === '' ? null : s;
      }
    }
  }

  value(key: string): DraftValue {
    return this.draft()[key];
  }

  set(key: string, value: DraftValue): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  isChanged(key: string): boolean {
    return this.draft()[key] !== this.original()[key];
  }

  /** Whether the input currently holds the default, regardless of what is saved. */
  isAtDefault(row: WebsiteSetting): boolean {
    return this.draft()[row.key] === this.toDraft(row, row.default);
  }

  resetToDefault(row: WebsiteSetting): void {
    this.set(row.key, this.toDraft(row, row.default));
  }

  undo(row: WebsiteSetting): void {
    this.set(row.key, this.original()[row.key]);
  }

  isDirectory(key: string): boolean {
    return DIRECTORY_KEYS.includes(key);
  }

  async toggle(row: WebsiteSetting, input: HTMLInputElement): Promise<void> {
    const next = input.checked;
    if (next && this.isDirectory(row.key)) {
      const ok = await this.dialog.confirm({
        title: 'web.settings.directory_confirm_title',
        text: row.key === 'directory.doctors_public' ? 'web.settings.directory_confirm_doctors' : 'web.settings.directory_confirm_hospitals',
        confirmText: 'web.settings.directory_confirm_btn',
        icon: 'warning',
        danger: true
      });
      if (!ok) {
        // The box already flipped in the DOM and the draft never changed, so
        // there is no binding update to undo it — put it back by hand.
        input.checked = false;
        return;
      }
    }
    this.set(row.key, next);
  }

  dir(key: string): 'rtl' | 'ltr' | null {
    if (/_ar$/.test(key)) return 'rtl';
    if (LTR_HINTS.some(h => key.toLowerCase().includes(h))) return 'ltr';
    return null;
  }

  label(key: string): string {
    const k = `web.settings.key.${key}`;
    const t = this.i18n.translate(k);
    return t === k ? key : t;
  }

  groupLabel(group: string): string {
    const k = `web.settings.group.${group}`;
    const t = this.i18n.translate(k);
    return t === k ? group : t;
  }

  /** One-line explanation of a group; empty for groups added after this screen was written. */
  groupHint(group: string): string {
    const k = `web.settings.group_hint.${group}`;
    const t = this.i18n.translate(k);
    return t === k ? '' : t;
  }

  /** Default value as a short read-only hint next to the badge. */
  defaultText(row: WebsiteSetting): string {
    const d = row.default;
    if (d === null || d === undefined || d === '') return '—';
    if (typeof d === 'boolean') return this.i18n.translate(d ? 'web.settings.on' : 'web.settings.off');
    if (Array.isArray(d)) return d.length ? d.join(', ') : '[]';
    if (typeof d === 'object') return JSON.stringify(d);
    return String(d);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }

  // ── save / discard / flush ──────────────────────────────────────

  discard(): void {
    this.draft.set({ ...this.original() });
    this.errors.set({});
    this.formError.set(null);
  }

  save(): void {
    const keys = this.changedKeys();
    if (!keys.length) return;
    const byKey = new Map(this.rows().map(r => [r.key, r]));
    const body: Record<string, unknown> = {};
    const local: Record<string, string> = {};
    for (const k of keys) {
      const row = byKey.get(k);
      if (!row) continue;
      try {
        body[k] = this.fromDraft(row, this.draft()[k]);
      } catch {
        local[k] = 'web.settings.invalid_json';
      }
    }
    if (Object.keys(local).length) {
      this.errors.set(local);
      this.formError.set('web.settings.fix_errors');
      return;
    }

    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    this.api.updateSettings(body).subscribe({
      next: rows => {
        this.saving.set(false);
        // The PATCH answers with the full list; fall back to a reload if it did not.
        if (Array.isArray(rows) && rows.length) this.init(rows);
        else this.load();
        this.dialog.toast('success', 'web.settings.saved');
      },
      error: err => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errors.set(this.mapErrors(fieldErrors(err)));
          this.formError.set(errorMessage(err, 'web.settings.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.settings.save_failed'));
        }
      }
    });
  }

  /**
   * Laravel reports a dotted request key with its dots intact
   * (`organization.same_as.1`), so an error belongs to the longest setting key
   * it starts with.
   */
  private mapErrors(raw: Record<string, string>): Record<string, string> {
    const keys = this.rows().map(r => r.key).sort((a, b) => b.length - a.length);
    const out: Record<string, string> = {};
    for (const [field, msg] of Object.entries(raw)) {
      const k = keys.find(key => field === key || field.startsWith(key + '.')) ?? field;
      if (!out[k]) out[k] = msg;
    }
    return out;
  }

  async flush(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.settings.flush_title',
      text: 'web.settings.flush_text',
      confirmText: 'web.settings.flush'
    });
    if (!ok) return;
    this.flushing.set(true);
    this.api.flushCache().subscribe({
      next: () => {
        this.flushing.set(false);
        this.dialog.toast('success', 'web.settings.flushed');
      },
      error: err => {
        this.flushing.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.settings.flush_failed'));
      }
    });
  }
}
