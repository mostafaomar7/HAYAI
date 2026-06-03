import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Advertisement, AdvertisementsService } from '../../../../core/services/advertisements.service';

@Component({
  selector: 'app-advertisements',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advertisements.html',
  styleUrl: './advertisements.css'
})
export class Advertisements {
  private router = inject(Router);
  private ads = inject(AdvertisementsService);

  loading = signal(true);
  adsList = signal<Advertisement[]>([]);
  search = signal('');

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.ads.list({ search: this.search() || undefined }).subscribe({
      next: r => { this.adsList.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    this.load();
  }

  onAdd() {
    this.router.navigate(['/dashboard/Advertisements/add']);
  }

  onEdit(id: number) {
    this.router.navigate(['/dashboard/Advertisements/edit', id]);
  }

  onDelete(id: number, event: Event) {
    event.stopPropagation();
    if (!confirm('Delete this advertisement?')) return;
    this.ads.delete(id).subscribe(() => this.load());
  }
}
