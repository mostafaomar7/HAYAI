import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoyaltyPromoCode, LoyaltyPromoRedemption, LoyaltyService } from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { LoyaltyPage } from '../loyalty-shared';

/**
 * Who used one promo code, newest first. Read-only. The code itself comes
 * from `GET promo-codes/{id}`, which also answers for an archived code, so a
 * deleted code's history stays reachable.
 */
@Component({
  selector: 'app-loyalty-promo-redemptions',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-promo-redemptions.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyPromoRedemptionsPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly perPage = 20;

  id = 0;
  promo = signal<LoyaltyPromoCode | null>(null);
  promoFailed = signal(false);
  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyPromoRedemption[]>([]);
  total = signal(0);
  from = signal('');
  to = signal('');
  page = signal(1);

  constructor() {
    super();
    this.id = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.svc.promoCode(this.id).subscribe({
      next: p => this.promo.set(p),
      error: () => this.promoFailed.set(true)
    });
    this.route.queryParamMap.subscribe(q => {
      this.from.set(q.get('from') || '');
      this.to.set(q.get('to') || '');
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.promoRedemptions(this.id, {
      from: this.from() || null,
      to: this.to() || null,
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => { this.items.set([]); this.total.set(0); this.failed.set(true); this.loading.set(false); }
    });
  }

  private navigate(patch: Record<string, string | number | null>): void {
    const current = { from: this.from() || null, to: this.to() || null };
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...current, page: null, ...patch } });
  }

  setDate(which: 'from' | 'to', v: string): void { this.navigate({ [which]: v || null }); }
  goToPage(p: number): void { this.navigate({ page: p > 1 ? p : null }); }

  usesText(p: LoyaltyPromoCode): string {
    return `${this.num(p.uses_count)} / ${p.max_uses === null ? '∞' : this.num(p.max_uses)}`;
  }
}
