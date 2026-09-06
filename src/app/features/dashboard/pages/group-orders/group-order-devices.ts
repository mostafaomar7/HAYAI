import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DeviceCategory,
  DeviceGroupOrdersService,
  ExternalDeviceEntry
} from '../../../../core/services/device-group-orders.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/**
 * Screen 5 — the catalogue. One row per device, showing the round currently
 * running for it (if any) rather than the device's own state, because "how full
 * is it" is the only question anyone opens this list to answer.
 */
@Component({
  selector: 'app-group-order-devices',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './group-order-devices.html',
  styleUrls: ['./group-orders.shared.css', './group-order-devices.css']
})
export class GroupOrderDevices {
  private svc = inject(DeviceGroupOrdersService);
  private dialog = inject(DialogService);
  private router = inject(Router);

  rows = signal<ExternalDeviceEntry[]>([]);
  categories = signal<DeviceCategory[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 15;
  page = signal(1);
  search = signal('');
  categoryId = signal<string>('');

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.load();
  });

  constructor() {
    this.load();
    // Unpaginated: this feeds a filter dropdown, and a second page of it would
    // silently hide categories from the filter.
    this.svc.categories({ per_page: 200 }).pipe(takeUntilDestroyed()).subscribe({
      next: res => this.categories.set(res.items),
      error: () => this.categories.set([])
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .devices({
        page: this.page(),
        per_page: this.perPage,
        search: this.search() || undefined,
        category_id: this.categoryId() || undefined
      })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: res => {
          this.rows.set(res.items);
          this.total.set(res.pagination.total);
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loadError.set('gorders.load_failed');
          this.loading.set(false);
        }
      });
  }

  setCategory(value: string): void {
    this.categoryId.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  addDevice(): void {
    this.router.navigate(['/dashboard/group-orders/devices/new']);
  }

  edit(row: ExternalDeviceEntry): void {
    this.router.navigate(['/dashboard/group-orders/devices', row.id, 'edit']);
  }

  /** Only meaningful once a round exists; the template hides the link otherwise. */
  viewRound(row: ExternalDeviceEntry): void {
    const order = row.active_group_order;
    if (order) this.router.navigate(['/dashboard/group-orders', order.id]);
  }

  async remove(row: ExternalDeviceEntry): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'gorders.delete_device_title',
      text: 'gorders.delete_device_text',
      params: { name: row.name },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;

    this.svc.deleteDevice(row.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'gorders.device_deleted');
        // Deleting the last row of a page would otherwise leave it empty.
        if (this.rows().length === 1 && this.page() > 1) this.page.set(this.page() - 1);
        this.load();
      },
      // The backend refuses to delete a device with a live round; it says why,
      // and that reason is more useful than a generic failure toast.
      error: err => this.dialog.error('common.error', err?.error?.message ?? 'gorders.delete_failed')
    });
  }

  categoryName(row: ExternalDeviceEntry): string {
    return row.category?.name ?? '—';
  }

  percent(row: ExternalDeviceEntry): number {
    const o = row.active_group_order;
    if (!o || !o.group_size) return 0;
    if (typeof o.progress === 'number') return Math.min(100, Math.max(0, o.progress));
    return Math.min(100, Math.round((o.joined / o.group_size) * 100));
  }

  remaining(row: ExternalDeviceEntry): number | string {
    const o = row.active_group_order;
    if (!o) return '—';
    return typeof o.remaining === 'number' ? o.remaining : Math.max(0, o.group_size - o.joined);
  }
}
