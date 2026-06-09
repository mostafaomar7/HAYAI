import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalDevice, ExternalDeviceOrder, ExternalDevicesService } from '../../../../core/services/external-devices.service';
import { DialogService } from '../../../../core/services/dialog.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-external-orders',
  standalone: true,
  imports: [CommonModule],
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
    this.svc.listOrders({ status: this.status() || undefined }).subscribe({
      next: r => { this.orders.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setStatus(s: string) { this.status.set(s); this.load(); }

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
    const { value: next } = await Swal.fire({
      title: 'Update order status',
      input: 'select',
      inputOptions: {
        pending: 'Pending',
        confirmed: 'Confirmed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
      },
      inputValue: o.status,
      showCancelButton: true,
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true
    });
    if (!next) return;

    let tracking: string | undefined;
    if (next === 'shipped') {
      const t = await this.dialog.prompt({
        title: 'Tracking number',
        placeholder: 'e.g. ABC-12345',
        text: 'Optional. Leave blank to skip.'
      });
      if (t === null) return;
      tracking = t || undefined;
    }

    this.svc.setOrderStatus(o.id, { status: next as string, tracking_number: tracking }).subscribe({
      next: () => { this.dialog.toast('success', 'Order updated'); this.load(); },
      error: err => this.dialog.error('Update failed', err.error?.message ?? 'Please try again.')
    });
  }
}
