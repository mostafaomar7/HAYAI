import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ClinicalGuideline,
  ClinicalGuidelinesService
} from '../../../../core/services/clinical-guidelines.service';
import {
  OPTION_LISTS,
  OptionListsService,
  OptionRow
} from '../../../../core/services/option-lists.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/**
 * The guidelines the doctor app lists. This screen is the only way content gets
 * there — nothing is seeded — so an empty table here means an empty screen in
 * the app, and the empty state says so.
 */
@Component({
  selector: 'app-clinical-guidelines',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './clinical-guidelines.html',
  styleUrl: './clinical-guidelines.css'
})
export class ClinicalGuidelines {
  private svc = inject(ClinicalGuidelinesService);
  private lists = inject(OptionListsService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private router = inject(Router);

  loading = signal(true);
  loadError = signal<string | null>(null);
  rows = signal<ClinicalGuideline[]>([]);
  total = signal(0);
  readonly perPage = 25;
  page = signal(1);
  search = signal('');
  subspecialtyFilter = signal('');
  /** '' = both, '1' = what doctors see, '0' = drafts. */
  publishedFilter = signal('');
  subspecialties = signal<OptionRow[]>([]);

  constructor() {
    this.lists.all(OPTION_LISTS['doctor-subspecialties']).subscribe({
      next: r => this.subspecialties.set(r.items),
      error: () => this.subspecialties.set([])
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const sub = Number(this.subspecialtyFilter());
    const pub = this.publishedFilter();
    this.svc
      .list({
        page: this.page(),
        per_page: this.perPage,
        search: this.search() || undefined,
        subspecialty_id: sub || undefined,
        is_published: pub === '' ? undefined : (Number(pub) as 0 | 1)
      })
      .subscribe({
        next: r => {
          this.rows.set(r.items);
          this.total.set(r.pagination?.total ?? r.items.length);
          this.loading.set(false);
        },
        error: () => { this.loadError.set('guidelines.load_failed'); this.loading.set(false); }
      });
  }

  /** "Specialty — Subspecialty", so Cardiology under Internal Medicine is not confused with Pediatric Cardiology. */
  subspecialtyLabel(row: OptionRow): string {
    return row.specialty?.name ? `${row.specialty.name} — ${row.name}` : row.name;
  }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.load();
  }, 350);

  setSubspecialty(value: string): void {
    this.subspecialtyFilter.set(value);
    this.page.set(1);
    this.load();
  }

  setPublished(value: string): void {
    this.publishedFilter.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  add(): void {
    this.router.navigate(['/dashboard/lists/clinical-guidelines/new']);
  }

  edit(row: ClinicalGuideline): void {
    this.router.navigate(['/dashboard/lists/clinical-guidelines', row.id, 'edit']);
  }

  async remove(row: ClinicalGuideline, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'guidelines.delete_title',
      text: 'guidelines.delete_text',
      params: { name: row.title || `#${row.id}` },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;

    this.svc.delete(row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'guidelines.deleted');
        // Deleting the last row of the last page would otherwise leave an empty page.
        if (this.rows().length === 1 && this.page() > 1) this.page.update(p => p - 1);
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('guidelines.delete_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /** The app's "Last updated": the review date when set, else the last edit. */
  lastUpdated(row: ClinicalGuideline): string | null {
    return row.last_updated_at ?? row.last_reviewed_at ?? row.updated_at ?? null;
  }

  /** Arabic-only guidelines exist; the title column should not come up blank. */
  titleOf(row: ClinicalGuideline): string {
    return row.title || row.title_en || row.title_ar || `#${row.id}`;
  }

  get lang(): string {
    return this.i18n.lang();
  }
}
