import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './plans.html',
  styleUrl: './plans.css'
})
export class Plans {
  private router = inject(Router);
  private svc = inject(PlansService);

  loading = signal(true);
  search = signal('');
  plansList = signal<Plan[]>([]);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({ search: this.search() || undefined }).subscribe({
      next: r => { this.plansList.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }

  goToDetails(id: number) {
    this.router.navigate(['/dashboard/plans/details', id]);
  }

  goToAdd() {
    this.router.navigate(['/dashboard/plans/add']);
  }
}
