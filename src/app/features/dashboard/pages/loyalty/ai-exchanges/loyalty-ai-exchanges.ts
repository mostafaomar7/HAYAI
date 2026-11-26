import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoyaltyAiExchange, LoyaltyService } from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { LoyaltyPage } from '../loyalty-shared';

/**
 * Points members swapped for AI tokens ("Request with points" in the app).
 * It happens at once in the app, so there is nothing to approve: this page
 * only reads. Each row keeps the rate it was made at; a later rate change
 * does not touch it. Filters live in the URL.
 */
@Component({
  selector: 'app-loyalty-ai-exchanges',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-ai-exchanges.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyAiExchangesPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyAiExchange[]>([]);
  total = signal(0);

  userId = signal('');
  from = signal('');
  to = signal('');
  page = signal(1);

  onUser = debounce((v: string) => {
    const id = v.replace(/\D/g, '');
    this.navigate({ user_id: id || null });
  });

  constructor() {
    super();
    this.route.queryParamMap.subscribe(q => {
      this.userId.set(q.get('user_id') || '');
      this.from.set(q.get('from') || '');
      this.to.set(q.get('to') || '');
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.aiExchanges({
      user_id: this.userId() || null,
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
    const current = { user_id: this.userId() || null, from: this.from() || null, to: this.to() || null };
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...current, page: null, ...patch } });
  }

  setDate(which: 'from' | 'to', v: string): void { this.navigate({ [which]: v || null }); }
  clearFilters(): void { this.router.navigate([], { relativeTo: this.route, queryParams: {} }); }
  goToPage(p: number): void { this.navigate({ page: p > 1 ? p : null }); }

  hasFilters(): boolean {
    return !!(this.userId() || this.from() || this.to());
  }

  /** Share of the bought tokens already used, 0–100. */
  usedPercent(x: LoyaltyAiExchange): number {
    if (!x.tokens || x.consumed_tokens === null || x.consumed_tokens === undefined) return 0;
    return Math.min(100, Math.round((x.consumed_tokens / x.tokens) * 100));
  }
}
