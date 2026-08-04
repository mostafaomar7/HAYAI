import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Plan, PlansService } from '../../../../core/services/plans.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-plans-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './plans-details.html',
  styleUrl: './plans-details.css'
})
export class PlansDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(PlansService);
  private dialog = inject(DialogService);

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

  async onDelete() {
    const id = this.plan()?.id;
    if (!id) return;
    const ok = await this.dialog.confirm({
      title: 'plans.delete_title',
      text: 'plans.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => {
        this.dialog.toast('success', 'plans.deleted');
        this.router.navigate(['/dashboard/plans']);
      },
      error: err => this.dialog.error('dialog.delete_failed', err.error?.message ?? 'dialog.try_again')
    });
  }
}
