import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoyaltyOverview, LoyaltyService, isoDay } from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { LoyaltyPage } from '../loyalty-shared';

/**
 * Hayai points at a glance. The period moves the earned / spent / expired
 * numbers only: "outstanding" (what members hold now, the platform's
 * liability) and "unsettled" (what we owe partners) are always right now.
 */
@Component({
  selector: 'app-loyalty-overview',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink],
  templateUrl: './loyalty-overview.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyOverviewPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);

  loading = signal(true);
  failed = signal(false);
  data = signal<LoyaltyOverview | null>(null);

  from = signal(isoDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  to = signal(isoDay(new Date()));

  constructor() {
    super();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.overview({ from: this.from(), to: this.to() }).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.failed.set(true); this.loading.set(false); }
    });
  }

  setRange(which: 'from' | 'to', value: string): void {
    if (!value) return;
    (which === 'from' ? this.from : this.to).set(value);
    if (this.from() > this.to()) (which === 'from' ? this.to : this.from).set(value);
    this.load();
  }

  thisMonth(): void {
    const now = new Date();
    this.from.set(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
    this.to.set(isoDay(now));
    this.load();
  }

  lastMonth(): void {
    const now = new Date();
    this.from.set(isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    this.to.set(isoDay(new Date(now.getFullYear(), now.getMonth(), 0)));
    this.load();
  }

  /** Spent = redeemed minus what came back from cancelled / expired vouchers. */
  spent(d: LoyaltyOverview): number {
    return (d.points?.redeemed ?? 0) - (d.points?.refunded ?? 0);
  }
}
