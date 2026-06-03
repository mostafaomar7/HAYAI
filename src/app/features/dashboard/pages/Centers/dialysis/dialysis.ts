import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';

@Component({
  selector: 'app-dialysis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialysis.html',
  styleUrl: './dialysis.css'
})
export class Dialysis {
  private router = inject(Router);
  private svc = inject(CentersService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  centers = signal<MedicalCenter[]>([]);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      category: 'dialysis',
      search: this.search() || undefined,
      status: this.statusFilter() || undefined
    }).subscribe({
      next: r => { this.centers.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }
  onStatusChange(value: string) { this.statusFilter.set(value as any); this.load(); }

  goToAdd() { this.router.navigate(['/dashboard/dialysis-add']); }
  goToDetails(id: number) { this.router.navigate(['/dashboard/dialysis-details', id]); }

  editCenter(event: Event, id: number) {
    event.stopPropagation();
    this.router.navigate(['/dashboard/dialysis/edit', id]);
  }

  deleteCenter(event: Event, id: number) {
    event.stopPropagation();
    if (!confirm('Delete this center?')) return;
    this.svc.delete(id).subscribe(() => this.load());
  }

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { this.showFilter = false; }
}
