import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CharitableOrganization, CharitableService } from '../../../../core/services/charitable.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-charitable',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './charitable.html',
  styleUrl: './charitable.css'
})
export class Charitable {
  private router = inject(Router);
  private svc = inject(CharitableService);
  private dialog = inject(DialogService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  charityList = signal<CharitableOrganization[]>([]);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      search: this.search() || undefined,
      status: this.statusFilter() || undefined
    }).subscribe({
      next: r => { this.charityList.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) { this.search.set(value); this.load(); }
  onStatusChange(value: string) { this.statusFilter.set(value as any); this.load(); }

  goToDetails(id: number) {
    this.router.navigate(['/dashboard/charitable/details', id]);
  }

  goToAdd() {
    this.router.navigate(['/dashboard/charitable/add']);
  }

  goToEdit(id: number, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/dashboard/charitable/edit', id]);
  }

  async onDelete(id: number, event: Event) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'Delete organization?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => { this.dialog.toast('success', 'Organization deleted'); this.load(); },
      error: () => this.dialog.error('Delete failed', 'Please try again.')
    });
  }

  toggleFilter() { this.showFilter = !this.showFilter; }
}
