import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Report,
  ReportStatus,
  ReportsService
} from '../../../../core/services/reports.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

/**
 * One report, with the copy of what was reported and the decision.
 *
 * The snapshot is the only record of the review once it is removed, so it is
 * shown in full rather than summarised.
 */
@Component({
  selector: 'app-report-details',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './report-details.html',
  styleUrl: './report-details.css'
})
export class ReportDetails {
  private svc = inject(ReportsService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id = Number(this.route.snapshot.paramMap.get('id'));
  report = signal<Report | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);
  busy = signal(false);
  adminNote = signal('');

  isRating = computed(() => this.report()?.target_type === 'rating');
  isDecided = computed(() => {
    const s = this.report()?.status;
    return s === 'actioned' || s === 'dismissed';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(this.id).subscribe({
      next: r => {
        this.report.set(r);
        this.adminNote.set(r.admin_note ?? '');
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadError.set(err.status === 404 ? 'reports.not_found' : 'reports.load_failed');
        this.loading.set(false);
      }
    });
  }

  stars(): string {
    const n = Number(this.report()?.target_snapshot?.rating ?? 0);
    return n > 0 ? '★'.repeat(Math.min(5, n)) + '☆'.repeat(Math.max(0, 5 - n)) : '—';
  }

  /** Everything the snapshot holds beyond the fields shown on their own. */
  extraSnapshot = computed<{ key: string; value: string }[]>(() => {
    const snap = this.report()?.target_snapshot;
    if (!snap) return [];
    const shown = new Set(['rating', 'comment', 'reviewer_name', 'rating_source', 'created_at']);
    return Object.entries(snap)
      .filter(([k, v]) => !shown.has(k) && v !== null && v !== undefined && v !== '')
      .map(([key, value]) => ({ key, value: String(value) }));
  });

  async decide(status: ReportStatus): Promise<void> {
    const row = this.report();
    if (!row) return;

    if (status === 'actioned' && this.isRating()) {
      const ok = await this.dialog.confirm({
        title: 'reports.confirm_remove_title',
        text: 'reports.confirm_remove_text',
        confirmText: 'reports.remove_review',
        danger: true
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.svc.decide(row.id, status, this.adminNote()).subscribe({
      next: res => {
        this.busy.set(false);
        if (status === 'actioned' && this.isRating()) {
          this.dialog.toast('success',
            res.review_removed ? 'reports.review_removed' : 'reports.review_already_gone');
        } else {
          this.dialog.toast('success', 'reports.decision_saved');
        }
        // Siblings on the same review moved too; the list is the safe place to
        // land rather than a row that may now be stale.
        this.router.navigate(['/dashboard/reports']);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.dialog.error('reports.decision_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }

  back(): void {
    if (window.history.length > 1) window.history.back();
    else this.router.navigate(['/dashboard/reports']);
  }
}
