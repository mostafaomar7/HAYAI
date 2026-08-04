import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CharitableOrganization, CharitableService } from '../../../../core/services/charitable.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../shared/utils/debounce.util';

@Component({
  selector: 'app-charitable',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
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

  readonly perPage = 12;
  page = signal(1);
  total = signal(0);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({
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
        this.charityList.set(r.items);
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
      title: 'charitable.delete_title',
      text: 'dialog.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => { this.dialog.toast('success', 'charitable.deleted'); this.load(); },
      error: () => this.dialog.error('dialog.delete_failed', 'dialog.try_again')
    });
  }

  toggleFilter() { this.showFilter = !this.showFilter; }
}
