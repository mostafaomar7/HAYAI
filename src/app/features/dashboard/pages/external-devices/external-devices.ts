import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalDevice, ExternalDevicesService } from '../../../../core/services/external-devices.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-external-devices',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './external-devices.html',
  styleUrl: './external-devices.css'
})
export class ExternalDevices {
  private svc = inject(ExternalDevicesService);
  private dialog = inject(DialogService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal('');
  sourceFilter = signal('');
  devices = signal<ExternalDevice[]>([]);
  total = signal(0);

  readonly perPage = 12;
  page = signal(1);

  activeFilterCount = computed(() =>
    (this.statusFilter() ? 1 : 0) + (this.sourceFilter() ? 1 : 0)
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listDevices({
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      source: this.sourceFilter() || undefined
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.devices.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Search and filters change the result set — restart from page 1. */
  private reload() { this.page.set(1); this.load(); }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((v: string) => {
    this.search.set(v);
    this.reload();
  });

  toggleFilter(event: Event) { event.stopPropagation(); this.showFilter = !this.showFilter; }
  preventClose(event: Event) { event.stopPropagation(); }
  @HostListener('document:click') closeFilter() { this.showFilter = false; }

  /** Formats a price with thousands separators; `null` renders as an em dash. */
  money(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : String(value);
  }

  /** Percentage saved against `original_price`, or null when not discounted. */
  discount(d: ExternalDevice): number | null {
    const was = Number(d.original_price);
    const now = Number(d.price);
    if (!Number.isFinite(was) || !Number.isFinite(now) || was <= now || was <= 0) return null;
    return Math.round(((was - now) / was) * 100);
  }

  applyFilters() { this.showFilter = false; this.reload(); }
  resetFilters() {
    this.statusFilter.set('');
    this.sourceFilter.set('');
    this.showFilter = false;
    this.reload();
  }

  async deleteDevice(id: number, event: Event) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'external.devices.delete_title',
      text: 'dialog.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.deleteDevice(id).subscribe({
      next: () => { this.dialog.toast('success', 'external.devices.deleted'); this.load(); },
      error: () => this.dialog.error('dialog.delete_failed', 'dialog.try_again')
    });
  }
}
