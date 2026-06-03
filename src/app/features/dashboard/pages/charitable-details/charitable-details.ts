import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CharitableOrganization, CharitableService } from '../../../../core/services/charitable.service';

@Component({
  selector: 'app-charitable-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charitable-details.html',
  styleUrl: './charitable-details.css'
})
export class CharitableDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CharitableService);

  loading = signal(true);
  org = signal<CharitableOrganization | null>(null);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.svc.get(id).subscribe({
        next: org => { this.org.set(org); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else {
      this.loading.set(false);
    }
  }

  goBack() { this.location.back(); }

  goToEdit() {
    const id = this.org()?.id;
    if (id) this.router.navigate(['/dashboard/charitable/edit', id]);
  }

  onDelete() {
    const id = this.org()?.id;
    if (!id || !confirm('Delete this organization?')) return;
    this.svc.delete(id).subscribe(() => this.router.navigate(['/dashboard/charitable']));
  }
}
