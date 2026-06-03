import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalDeviceOrder, ExternalDevicesService } from '../../../../core/services/external-devices.service';

@Component({
  selector: 'app-external-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './external-orders.html',
  styleUrl: './external-orders.css'
})
export class ExternalOrders {
  private svc = inject(ExternalDevicesService);

  loading = signal(true);
  status = signal('');
  orders = signal<ExternalDeviceOrder[]>([]);
  total = signal(0);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listOrders({ status: this.status() || undefined }).subscribe({
      next: r => { this.orders.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  setStatus(s: string) { this.status.set(s); this.load(); }

  changeOrderStatus(o: ExternalDeviceOrder) {
    const next = prompt('New status (pending|confirmed|shipped|delivered|cancelled):', o.status);
    if (!next) return;
    const tracking = next === 'shipped' ? (prompt('Tracking number (optional):') ?? undefined) : undefined;
    this.svc.setOrderStatus(o.id, { status: next, tracking_number: tracking }).subscribe(() => this.load());
  }
}
