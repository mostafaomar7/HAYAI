import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Advertisement, AdvertisementsService } from '../../../../core/services/advertisements.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-advertisements',
  standalone: true,
  imports: [CommonModule, TPipe],
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
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      is_published:
        this.publishedFilter() === 'true' ? true :
        this.publishedFilter() === 'false' ? false : undefined
    }).subscribe({
      next: r => { this.adsList.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { this.showFilter = false; }

  applyFilters() {
    this.showFilter = false;
    this.load();
  }

  resetFilters() {
    this.statusFilter.set('');
    this.publishedFilter.set('');
    this.showFilter = false;
    this.load();
  }

  onAdd() { this.router.navigate(['/dashboard/Advertisements/add']); }
  onEdit(id: number) { this.router.navigate(['/dashboard/Advertisements/edit', id]); }

  async onDelete(id: number, event: Event) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'Delete advertisement?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.ads.delete(id).subscribe({
      next: () => {
        this.dialog.toast('success', 'Advertisement deleted');
        this.load();
      },
      error: () => this.dialog.error('Delete failed', 'Please try again.')
    });
  }
}
