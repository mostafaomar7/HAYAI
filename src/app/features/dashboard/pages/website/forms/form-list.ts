import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { WebsiteForm } from '../../../../../core/services/website/website.models';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { enumLabel } from '../purchases/sales-shared';

/**
 * Website forms. System forms (contact, hospital partnership …) are wired into
 * the site by their key, so the API refuses to delete them or change their
 * key/type; the delete action is disabled for them rather than left to fail.
 */
@Component({
  selector: 'app-form-list',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent, RouterLink],
  templateUrl: './form-list.html',
  styleUrls: ['../shared/website.shared.css', './form-list.css']
})
export class FormList {
  private api = inject(WebsiteApiService);
  readonly ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private dialog = inject(DialogService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  rows = signal<WebsiteForm[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 20;
  page = signal(1);
  search = signal('');

  private sub?: Subscription;

  onSearch = debounce((value: string) => {
    this.search.set(value.trim());
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.sub = this.api
      .forms({ page: this.page(), per_page: this.perPage, q: this.search() || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: err => {
          this.rows.set([]);
          this.loadError.set(errorMessage(err, 'web.forms.load_failed'));
          this.loading.set(false);
        }
      });
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  create(): void {
    this.router.navigate(['/dashboard/website/forms/new']);
  }

  open(row: WebsiteForm): void {
    this.router.navigate(['/dashboard/website/forms', row.id]);
  }

  name(row: WebsiteForm): string {
    if (this.i18n.lang() === 'ar' && row.name_ar) return row.name_ar;
    return row.name || row.name_en || row.key;
  }

  typeLabel(row: WebsiteForm): string {
    return enumLabel(this.i18n, 'form_type', row.type, row['type_label'] as string | undefined);
  }

  async remove(row: WebsiteForm, event: Event): Promise<void> {
    event.stopPropagation();
    if (row.is_system) return;
    const ok = await this.dialog.confirm({
      title: 'web.forms.delete_title',
      text: row.leads_count ? 'web.forms.delete_text_leads' : 'web.forms.delete_text',
      params: { name: this.name(row), count: row.leads_count ?? 0 },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteForm(row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.forms.deleted');
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.forms.delete_failed'))
    });
  }
}
