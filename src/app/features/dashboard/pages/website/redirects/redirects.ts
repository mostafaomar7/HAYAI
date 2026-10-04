import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { RedirectInput, WebsiteRedirect } from '../../../../../core/services/website/website.models';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate, nullIfEmpty } from '../shared/website-utils';

interface RedirectDraft {
  source_path: string;
  destination: string;
  status_code: number;
  is_active: boolean;
  notes: string;
}

/**
 * Redirects (§13.2). Most rows are written by the backend itself when a
 * published page's slug changes (`is_automatic`); admins add the rest by hand
 * for old URLs and campaign links. The backend rejects loops, duplicate
 * sources, a source that is a live page, `javascript:` / `data:` targets and
 * redirecting `/` — its 422 messages are shown as-is under the inputs.
 */
@Component({
  selector: 'app-website-redirects',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, PaginationComponent],
  templateUrl: './redirects.html',
  styleUrls: ['../shared/website.shared.css', './redirects.css']
})
export class Redirects {
  private api = inject(WebsiteApiService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  readonly ctx = inject(WebsiteContextService);

  /** 301 is the default: the old URL is gone for good and search engines should move its ranking over. */
  readonly statusCodes = [301, 302, 307, 308];

  rows = signal<WebsiteRedirect[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 25;
  page = signal(1);
  q = signal('');
  isActive = signal('');
  isAutomatic = signal('');

  // editor modal
  editing = signal<WebsiteRedirect | null>(null);
  modalOpen = signal(false);
  draft = signal<RedirectDraft>(this.blank());
  saving = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  // URL tester
  testPath = signal('');
  testing = signal(false);
  testResult = signal<{ location: string; status_code: number } | null | undefined>(undefined);
  testedPath = signal('');

  onSearch = debounce((value: string) => {
    this.q.set(value.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .redirects({
        page: this.page(),
        per_page: this.perPage,
        q: this.q() || undefined,
        is_active: this.isActive() || undefined,
        is_automatic: this.isAutomatic() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.redirects.load_failed'));
          this.loading.set(false);
        }
      });
  }

  setFilter(which: 'active' | 'automatic', value: string): void {
    (which === 'active' ? this.isActive : this.isAutomatic).set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  // ── editor ──────────────────────────────────────────────────────

  private blank(): RedirectDraft {
    return { source_path: '', destination: '', status_code: 301, is_active: true, notes: '' };
  }

  openCreate(): void {
    this.editing.set(null);
    this.draft.set(this.blank());
    this.errors.set({});
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEdit(row: WebsiteRedirect): void {
    this.editing.set(row);
    this.draft.set({
      source_path: row.source_path,
      destination: row.destination,
      status_code: row.status_code || 301,
      is_active: row.is_active,
      notes: row.notes ?? ''
    });
    this.errors.set({});
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modalOpen.set(false);
  }

  patch<K extends keyof RedirectDraft>(key: K, value: RedirectDraft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
  }

  save(): void {
    const d = this.draft();
    const body: RedirectInput = {
      source_path: d.source_path.trim(),
      destination: d.destination.trim(),
      status_code: Number(d.status_code),
      is_active: d.is_active,
      notes: nullIfEmpty(d.notes)
    };
    const editing = this.editing();
    this.saving.set(true);
    this.errors.set({});
    this.formError.set(null);
    const req = editing ? this.api.updateRedirect(editing.id, body) : this.api.createRedirect(body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.dialog.toast('success', editing ? 'web.redirects.updated' : 'web.redirects.created');
        this.load();
      },
      error: err => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errors.set(fieldErrors(err));
          this.formError.set(errorMessage(err, 'web.redirects.save_failed'));
        } else {
          this.dialog.error('common.error', errorMessage(err, 'web.redirects.save_failed'));
        }
      }
    });
  }

  /** Quick on/off without opening the editor — the common case when an old campaign ends. */
  toggleActive(row: WebsiteRedirect): void {
    this.api.updateRedirect(row.id, { is_active: !row.is_active }).subscribe({
      next: updated => {
        this.rows.update(list => list.map(r => (r.id === row.id ? { ...r, ...(updated ?? {}), is_active: !row.is_active } : r)));
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.redirects.save_failed'))
    });
  }

  async remove(row: WebsiteRedirect): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.redirects.delete_title',
      text: row.is_automatic ? 'web.redirects.delete_text_auto' : 'web.redirects.delete_text',
      params: { source: row.source_path },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteRedirect(row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.redirects.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.redirects.delete_failed'))
    });
  }

  // ── tester ──────────────────────────────────────────────────────

  test(): void {
    const path = this.testPath().trim();
    if (!path) return;
    this.testing.set(true);
    this.api.testRedirect(path).subscribe({
      next: res => {
        this.testedPath.set(path);
        // The API answers `null` (not 404) when nothing matches.
        this.testResult.set(res && res.location ? res : null);
        this.testing.set(false);
      },
      error: err => {
        this.testing.set(false);
        this.testResult.set(undefined);
        this.dialog.error('common.error', errorMessage(err, 'web.redirects.test_failed'));
      }
    });
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }
}
