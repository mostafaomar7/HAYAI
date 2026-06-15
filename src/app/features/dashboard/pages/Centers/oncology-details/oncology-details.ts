import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-oncology-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './oncology-details.html',
  styleUrl: './oncology-details.css'
})
export class OncologyDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CentersService);
  private dialog = inject(DialogService);

  loading = signal(true);
  center = signal<MedicalCenter | null>(null);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.svc.get(id).subscribe({
        next: c => { this.center.set(c); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else {
      this.loading.set(false);
    }
  }

  goBack() { this.location.back(); }
  goToEdit() {
    const id = this.center()?.id;
    if (id) this.router.navigate(['/dashboard/Oncology/edit', id]);
  }

  async onDelete() {
    const id = this.center()?.id;
    if (!id) return;
    const ok = await this.dialog.confirm({
      title: 'Delete center?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => {
        this.dialog.toast('success', 'Center deleted');
        this.router.navigate(['/dashboard/Oncology']);
      },
      error: () => this.dialog.error('Delete failed', 'Please try again.')
    });
  }
}
