import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';

@Component({
  selector: 'app-hyperbaric-oxygen-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hyperbaric-oxygen-details.html',
  styleUrl: './hyperbaric-oxygen-details.css'
})
export class HyperbaricOxygenDetails {
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
    if (id) this.router.navigate(['/dashboard/HyperbaricOxygen/edit', id]);
  }
  onDelete() {
    const id = this.center()?.id;
    if (!id || !confirm('Delete this center?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/dashboard/HyperbaricOxygen']));
  }
}
