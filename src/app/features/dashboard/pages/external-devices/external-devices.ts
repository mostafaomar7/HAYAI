import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExternalDevice, ExternalDevicesService } from '../../../../core/services/external-devices.service';

@Component({
  selector: 'app-external-devices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './external-devices.html',
  styleUrl: './external-devices.css'
})
export class ExternalDevices {
  private svc = inject(ExternalDevicesService);

  loading = signal(true);
  showFilter = false;
  search = signal('');
  statusFilter = signal('');
  sourceFilter = signal('');
  devices = signal<ExternalDevice[]>([]);
  total = signal(0);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.listDevices({
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      source: this.sourceFilter() || undefined
    }).subscribe({
      next: r => { this.devices.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(v: string) { this.search.set(v); this.load(); }
  toggleFilter(event: Event) { event.stopPropagation(); this.showFilter = !this.showFilter; }
  preventClose(event: Event) { event.stopPropagation(); }
  @HostListener('document:click') closeFilter() { this.showFilter = false; }

  applyFilters() { this.showFilter = false; this.load(); }
  resetFilters() {
    this.statusFilter.set('');
    this.sourceFilter.set('');
    this.showFilter = false;
    this.load();
  }

  deleteDevice(id: number, event: Event) {
    event.stopPropagation();
    if (!confirm('Delete this device?')) return;
    this.svc.deleteDevice(id).subscribe(() => this.load());
  }
}
