import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ExternalDeviceOrder,
  ExternalDevicesService
} from '../../../../core/services/external-devices.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

/**
 * One device order, opened from the activity timeline.
 *
 * The list page cannot serve this: it is paginated, so an order referenced by an
 * activity row from months ago may be several pages deep, and the row carries
 * only an id. This addresses the order directly.
 *
 * Device orders are the only activity type with an admin endpoint behind them —
 * pharmacy orders, lab orders, insurance and therapy requests, job posts and
 * applications all return 404 on every admin path, so they have no screen to
 * open until the backend exposes them.
 */
@Component({
  selector: 'app-external-order-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './external-order-details.html',
  styleUrl: './external-order-details.css'
})
export class ExternalOrderDetails {
  private svc = inject(ExternalDevicesService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  order = signal<ExternalDeviceOrder | null>(null);
  /** The order carries only `device_id`; the catalogue entry supplies the name. */
  deviceName = signal<string | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);
  busy = signal(false);

  id = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getOrder(this.id).pipe(takeUntilDestroyed()).subscribe({
      next: o => {
        this.order.set(o);
        this.loading.set(false);
        if (o.device_id) this.loadDevice(o.device_id);
      },
      error: () => { this.loadError.set('external.orders.load_failed'); this.loading.set(false); }
    });
  }

  private loadDevice(id: number): void {
    this.svc.getDevice(id).subscribe({
      // A missing device is not worth failing the page over: the id still shows.
      next: d => this.deviceName.set(d?.name ?? null),
      error: () => this.deviceName.set(null)
    });
  }

  deviceLabel = computed(() => this.deviceName() ?? `#${this.order()?.device_id ?? '—'}`);

  /** Everything the address object actually filled in, joined once. */
  addressLine = computed(() => {
    const a = this.order()?.address;
    if (!a) return null;
    const parts = [a.line, a.city, a.governorate, a.postal_code].filter(Boolean);
    return parts.length ? parts.join('، ') : null;
  });

  hasMoney = computed(() => {
    const o = this.order();
    return !!o && (o.total_price !== null || o.grand_total !== undefined);
  });

  async updateStatus(): Promise<void> {
    const o = this.order();
    if (!o) return;

    const next = await this.dialog.select({
      title: 'external.orders.update_status',
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

    // A shipment without a tracking number is the one case the customer cannot
    // act on, so it is asked for at the point the status changes.
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

    this.busy.set(true);
    this.svc.setOrderStatus(o.id, { status: next, tracking_number: tracking }).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.toast('success', 'external.orders.updated');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.dialog.error('dialog.update_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  back(): void {
    // history.back keeps the activity timeline's filters and scroll position,
    // which a router navigation to the list would throw away.
    if (window.history.length > 1) window.history.back();
    else this.router.navigate(['/dashboard/external/orders']);
  }
}
