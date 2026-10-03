import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WebsiteApiService } from '../../../../../../core/services/website/website-api.service';
import { Locale, WebsitePageRow } from '../../../../../../core/services/website/website.models';
import { debounce } from '../../../../../../shared/utils/debounce.util';
import { pickLocalized, translationFor } from '../../shared/website-utils';

/**
 * Parent-page chooser: a search box over `GET /pages?q=` with the current
 * choice shown as title + path. Emits the whole row, because the caller needs
 * the parent's path per language to preview the resulting URL.
 */
@Component({
  selector: 'app-page-picker',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './page-picker.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './page-picker.css']
})
export class PagePicker {
  private api = inject(WebsiteApiService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  value = input<number | null>(null);
  /** The language whose path is shown next to each result. */
  locale = input<Locale>('en');
  /** The page being edited: it cannot be its own parent. */
  excludeId = input<number | null>(null);
  disabled = input(false);

  picked = output<WebsitePageRow | null>();

  selected = signal<WebsitePageRow | null>(null);
  results = signal<WebsitePageRow[]>([]);
  searching = signal(false);
  open = signal(false);
  q = signal('');

  private lang = computed(() => this.i18n.lang() as Locale);

  constructor() {
    // Resolve an existing parent id into a row so it shows by name.
    effect(() => {
      const id = this.value();
      untracked(() => {
        if (!id) { this.selected.set(null); return; }
        if (this.selected()?.id === id) return;
        this.api.page(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: p => this.selected.set(p),
          error: () => this.selected.set(null)
        });
      });
    });
  }

  onSearch = debounce((value: string) => {
    this.q.set(value.trim());
    this.search();
  }, 300);

  focus(): void {
    if (this.disabled()) return;
    this.open.set(true);
    if (!this.results().length) this.search();
  }

  search(): void {
    this.searching.set(true);
    this.api.pages({ q: this.q() || undefined, per_page: 10, sort: 'updated' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.results.set(res.items.filter(p => p.id !== this.excludeId()));
          this.searching.set(false);
        },
        error: () => { this.results.set([]); this.searching.set(false); }
      });
  }

  choose(row: WebsitePageRow): void {
    this.selected.set(row);
    this.open.set(false);
    this.picked.emit(row);
  }

  clear(): void {
    this.selected.set(null);
    this.picked.emit(null);
  }

  close(): void {
    // Delayed so a click on a result lands before the list disappears.
    setTimeout(() => this.open.set(false), 150);
  }

  title(row: WebsitePageRow): string {
    return pickLocalized(row.translations, 'title', this.lang()) || `#${row.id}`;
  }

  path(row: WebsitePageRow): string {
    const tr = translationFor(row.translations, this.locale()) ?? row.translations[0];
    return tr ? `/${tr.locale}/${tr.path ?? tr.slug}` : '';
  }
}
