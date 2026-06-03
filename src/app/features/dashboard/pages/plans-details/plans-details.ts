import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Plan, PlansService } from '../../../../core/services/plans.service';

@Component({
  selector: 'app-plans-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plans-details.html',
  styleUrl: './plans-details.css'
})
export class PlansDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(PlansService);

  loading = signal(true);
  plan = signal<Plan | null>(null);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.svc.get(id).subscribe({
        next: p => { this.plan.set(p); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else {
      this.loading.set(false);
    }
  }

  goBack() { this.location.back(); }

  goToEdit() {
    const id = this.plan()?.id;
    if (id) this.router.navigate(['/dashboard/plans/edit', id]);
  }

  onDelete() {
    const id = this.plan()?.id;
    if (!id || !confirm('Delete this plan?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/dashboard/plans']));
  }
}
