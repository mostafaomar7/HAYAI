import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalDevice, ExternalDeviceOrder, ExternalDevicesService } from '../../../../core/services/external-devices.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-external-orders',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './external-orders.html',
  styleUrl: './external-orders.css'
})
export class ExternalOrders {
  private svc = inject(ExternalDevicesService);
  private dialog = inject(DialogService);

  loading = signal(true);
  status = signal('');
  orders = signal<ExternalDeviceOrder[]>([]);
  total = signal(0);
  devicesById = signal<Map<number, ExternalDevice>>(new Map());

  readonly perPage = 15;
  page = signal(1);

  constructor() {
    this.load();
    this.svc.listDevices({ per_page: 100 }).subscribe({
      next: r => {
        const m = new Map<number, ExternalDevice>();
        for (const d of r.items) m.set(d.id, d);
        this.devicesById.set(m);
      },
      error: () => {}
    });
  }

  load() {
    this.loading.set(true);
    this.svc.listOrders({
      page: this.page(),
      per_page: this.perPage,
      status: this.status() || undefined
    }).subscribe({
      next: r => {
        // A status change can empty the current page — fall back one page.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.orders.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  setStatus(s: string) {
    this.status.set(s);
    // A different tab is a different result set — restart from page 1.
    this.page.set(1);
    this.load();
  }

  deviceName(id: number): string {
    return this.devicesById().get(id)?.name ?? `Device #${id}`;
  }

  initials(name?: string | null): string {
    if (!name) return '?';
    const cleaned = name.trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  }

  avatarColor(name?: string | null): string {
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    const s = name ?? '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  async changeOrderStatus(o: ExternalDeviceOrder) {
    const next = await this.dialog.select({
      title: 'external.orders.update_status_title',
      options: {
        pending: 'external.orders.tab.pending',
        confirmed: 'external.orders.tab.confirmed',
        shipped: 'external.orders.tab.shipped',
        delivered: 'external.orders.tab.delivered',
        cancelled: 'external.orders.tab.cancelled'
      },
      defaultValue: o.status,
      confirmText: 'common.continue'
    });
    if (!next) return;

    let tracking: string | undefined;
    if (next === 'shipped') {
      const t = await this.dialog.prompt({
        title: 'external.orders.tracking_title',
        placeholder: 'external.orders.tracking_placeholder',
        text: 'external.orders.tracking_hint'
      });
      if (t === null) return;
      tracking = t || undefined;
    }

    this.svc.setOrderStatus(o.id, { status: next, tracking_number: tracking }).subscribe({
      next: () => { this.dialog.toast('success', 'external.orders.updated'); this.load(); },
      error: err => this.dialog.error('dialog.update_failed', err.error?.message ?? 'dialog.try_again')
    });
  }
}
