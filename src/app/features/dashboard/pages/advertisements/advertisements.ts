import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Advertisement, AdvertisementsService } from '../../../../core/services/advertisements.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-advertisements',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './advertisements.html',
  styleUrl: './advertisements.css'
})
export class Advertisements {
  private router = inject(Router);
  private ads = inject(AdvertisementsService);
  private dialog = inject(DialogService);

  loading = signal(true);
  adsList = signal<Advertisement[]>([]);
  search = signal('');

  readonly perPage = 12;
  page = signal(1);
  total = signal(0);

  // Filter state
  showFilter = false;
  statusFilter = signal<'' | 'active' | 'expired'>('');
  publishedFilter = signal<'' | 'true' | 'false'>('');

  activeFilterCount = computed(() =>
    [this.statusFilter(), this.publishedFilter()].filter(v => !!v).length
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.ads.list({
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      is_published:
        this.publishedFilter() === 'true' ? true :
        this.publishedFilter() === 'false' ? false : undefined
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.adsList.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Search and filters change the result set — restart from page 1. */
  private reload() { this.page.set(1); this.load(); }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.reload();
  });

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { this.showFilter = false; }

  applyFilters() {
    this.showFilter = false;
    this.reload();
  }

  resetFilters() {
    this.statusFilter.set('');
    this.publishedFilter.set('');
    this.showFilter = false;
    this.reload();
  }

  onAdd() { this.router.navigate(['/dashboard/Advertisements/add']); }
  onEdit(id: number) { this.router.navigate(['/dashboard/Advertisements/edit', id]); }

  async onDelete(id: number, event: Event) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'ads.delete_title',
      text: 'dialog.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.ads.delete(id).subscribe({
      next: () => {
        this.dialog.toast('success', 'ads.deleted');
        this.load();
      },
      error: () => this.dialog.error('dialog.delete_failed', 'dialog.try_again')
    });
  }
}
