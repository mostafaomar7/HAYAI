import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CentersService, MedicalCenter } from '../../../../../core/services/centers.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-dialysis',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './dialysis.html',
  styleUrl: './dialysis.css'
})
export class Dialysis {
  private router = inject(Router);
  private svc = inject(CentersService);
  private dialog = inject(DialogService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal<'' | 'active' | 'inactive'>('');
  centers = signal<MedicalCenter[]>([]);

  readonly perPage = 12;
  page = signal(1);
  total = signal(0);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
      category: 'dialysis',
      page: this.page(),
      per_page: this.perPage,
      search: this.search() || undefined,
      status: this.statusFilter() || undefined
    }).subscribe({
      next: r => {
        // Deleting the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.centers.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Search and filters change the result set — restart from page 1. */
  private reload() { this.page.set(1); this.load(); }

  goToPage(page: number) { this.page.set(page); this.load(); }

  onSearch = debounce((value: string) => {
    this.search.set(value);
    this.reload();
  });

  onStatusChange(value: string) { this.statusFilter.set(value as any); this.reload(); }

  goToAdd() { this.router.navigate(['/dashboard/dialysis-add']); }
  goToDetails(id: number) { this.router.navigate(['/dashboard/dialysis-details', id]); }

  editCenter(event: Event, id: number) {
    event.stopPropagation();
    this.router.navigate(['/dashboard/dialysis/edit', id]);
  }

  async deleteCenter(event: Event, id: number) {
    event.stopPropagation();
    const ok = await this.dialog.confirm({
      title: 'centers.delete_title',
      text: 'dialog.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => { this.dialog.toast('success', 'centers.deleted'); this.load(); },
      error: () => this.dialog.error('dialog.delete_failed', 'dialog.try_again')
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
