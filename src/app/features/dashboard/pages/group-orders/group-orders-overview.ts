import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DeviceGroupOrdersService,
  GroupOrderDashboard,
  GroupOrderStatus,
  GroupOrderSummary,
  GROUP_ORDER_STATUSES
} from '../../../../core/services/device-group-orders.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

/**
 * Screens 1 and 6 of the group-order flow: the four headline tiles, and the
 * table of every round with its fill progress.
 *
 * They are one page rather than two because screen 6 is screen 1's table with
 * the tiles scrolled off — splitting them would mean two routes rendering the
 * same query, and an admin bouncing between them to answer one question.
 */
@Component({
  selector: 'app-group-orders-overview',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './group-orders-overview.html',
  styleUrls: ['./group-orders.shared.css', './group-orders-overview.css']
})
export class GroupOrdersOverview {
  private svc = inject(DeviceGroupOrdersService);
  private router = inject(Router);

  readonly statuses = GROUP_ORDER_STATUSES;

  stats = signal<GroupOrderDashboard | null>(null);
  statsLoading = signal(true);

  rows = signal<GroupOrderSummary[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);
  total = signal(0);
  readonly perPage = 15;
  page = signal(1);
  search = signal('');
  status = signal<GroupOrderStatus | ''>('');

  /** Fires 350ms after the last keystroke rather than once per character. */
  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.page.set(1);
    this.loadRows();
  });

  constructor() {
    this.loadStats();
    this.loadRows();
  }

  private loadStats(): void {
    this.statsLoading.set(true);
    this.svc.dashboard().pipe(takeUntilDestroyed()).subscribe({
      next: d => { this.stats.set(d); this.statsLoading.set(false); },
      // The tiles are a summary of the table below them: if they fail the page
      // is still useful, so the failure is swallowed rather than blocking it.
      error: () => this.statsLoading.set(false)
    });
  }

  loadRows(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .groupOrders({
        page: this.page(),
        per_page: this.perPage,
        search: this.search() || undefined,
        status: this.status() || undefined
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

  setStatus(value: string): void {
    this.status.set(value as GroupOrderStatus | '');
    this.page.set(1);
    this.loadRows();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.loadRows();
  }

  open(row: GroupOrderSummary): void {
    this.router.navigate(['/dashboard/group-orders', row.id]);
  }

  /**
   * Fill against the target, from confirmed units only. `progress_percent` is
   * used when the API sends it; the fallback keeps the bar honest if it does
   * not, and clamps so a round that overshoots cannot draw past the track.
   */
  percent(row: GroupOrderSummary): number {
    if (typeof row.progress === 'number') return Math.min(100, Math.max(0, row.progress));
    if (!row.group_size) return 0;
    return Math.min(100, Math.round((row.joined / row.group_size) * 100));
  }

  remaining(row: GroupOrderSummary): number {
    if (typeof row.remaining === 'number') return row.remaining;
    return Math.max(0, row.group_size - row.joined);
  }

  /** Falls back to the raw token so an unmapped status still reads as something. */
  statusLabel(row: { status: GroupOrderStatus; status_label?: string }): string {
    return row.status_label || row.status;
  }

  /** The device arrives nested; there is no flat `device_name` on the wire. */
  deviceName(row: GroupOrderSummary): string {
    return row.device?.name ?? '';
  }
}
