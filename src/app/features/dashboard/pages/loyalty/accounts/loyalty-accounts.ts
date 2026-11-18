import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoyaltyAccountRow, LoyaltyService } from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { LoyaltyPage } from '../loyalty-shared';

/** Members' points. Search takes a name, email, phone or invite code. */
@Component({
  selector: 'app-loyalty-accounts',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-accounts.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyAccountsPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyAccountRow[]>([]);
  total = signal(0);
  page = signal(1);
  search = signal('');
  type = signal<'' | 'patient' | 'tourist'>('');
  sort = signal<'balance' | 'recent'>('balance');

  onSearch = debounce((v: string) => { this.search.set(v.trim()); this.page.set(1); this.load(); });

  constructor() {
    super();
    const q = this.route.snapshot.queryParamMap;
    this.search.set(q.get('search') || '');
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.accounts({
      search: this.search() || null,
      user_type: this.type() || null,
      sort: this.sort(),
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => { this.items.set([]); this.total.set(0); this.failed.set(true); this.loading.set(false); }
    });
  }

  setType(v: string): void { this.type.set(v as '' | 'patient' | 'tourist'); this.page.set(1); this.load(); }
  setSort(v: string): void { this.sort.set(v === 'recent' ? 'recent' : 'balance'); this.page.set(1); this.load(); }
  goToPage(p: number): void { this.page.set(p); this.load(); }

  open(a: LoyaltyAccountRow): void {
    this.router.navigate(['/dashboard/loyalty/accounts', a.user_id]);
  }
}
