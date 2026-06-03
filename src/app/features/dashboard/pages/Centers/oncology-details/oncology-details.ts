import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';

@Component({
  selector: 'app-oncology-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oncology-details.html',
  styleUrl: './oncology-details.css'
})
export class OncologyDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CentersService);

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
  onDelete() {
    const id = this.center()?.id;
    if (!id || !confirm('Delete this center?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/dashboard/Oncology']));
  }
}
