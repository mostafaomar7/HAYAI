import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-oncology',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './oncology.html',
  styleUrl: './oncology.css'
})
export class Oncology {
  private router = inject(Router);
  private svc = inject(CentersService);
  private dialog = inject(DialogService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  centers = signal<MedicalCenter[]>([]);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      category: 'oncology',
      search: this.search() || undefined,
      status: this.statusFilter() || undefined
    }).subscribe({
      next: r => { this.centers.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }
  onStatusChange(value: string) { this.statusFilter.set(value as any); this.load(); }

  goToAdd() { this.router.navigate(['/dashboard/Oncology-add']); }
  goToDetails(id: number) { this.router.navigate(['/dashboard/Oncology-details', id]); }

  editCenter(event: Event, id: number) {
    event.stopPropagation();
    this.router.navigate(['/dashboard/Oncology/edit', id]);
  }

  async deleteCenter(event: Event, id: number) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'Delete center?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => { this.dialog.toast('success', 'Center deleted'); this.load(); },
      error: () => this.dialog.error('Delete failed', 'Please try again.')
    });
  }

  toggleFilter(event: Event) {
    event.stopPropagation();
    this.showFilter = !this.showFilter;
  }

  preventClose(event: Event) { event.stopPropagation(); }

  @HostListener('document:click')
  closeFilter() { this.showFilter = false; }
}
