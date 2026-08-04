import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CharitableOrganization, CharitableService } from '../../../../core/services/charitable.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-charitable-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './charitable-details.html',
  styleUrl: './charitable-details.css'
})
export class CharitableDetails {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(CharitableService);
  private dialog = inject(DialogService);

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

  async onDelete() {
    const id = this.org()?.id;
    if (!id) return;
    const ok = await this.dialog.confirm({
      title: 'charitable.delete_title',
      text: 'dialog.delete_text',
      icon: 'warning',
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.svc.delete(id).subscribe({
      next: () => {
        this.dialog.toast('success', 'charitable.deleted');
        this.router.navigate(['/dashboard/charitable']);
      },
      error: () => this.dialog.error('dialog.delete_failed', 'dialog.try_again')
    });
  }
}
