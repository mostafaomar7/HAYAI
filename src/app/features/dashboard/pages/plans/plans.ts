import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './plans.html',
  styleUrl: './plans.css'
})
export class Plans {
  private router = inject(Router);
  private svc = inject(PlansService);

  loading = signal(true);
  search = signal('');
  plansList = signal<Plan[]>([]);

  readonly perPage = 12;
  page = signal(1);
  total = signal(0);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.plansList.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    // A new search changes the result set — restart from page 1.
    this.page.set(1);
    this.load();
  });

  goToDetails(id: number) {
    this.router.navigate(['/dashboard/plans/details', id]);
  }

  goToAdd() {
    this.router.navigate(['/dashboard/plans/add']);
  }
}
