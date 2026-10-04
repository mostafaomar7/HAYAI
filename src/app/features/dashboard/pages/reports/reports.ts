import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Report,
  ReportStatus,
  ReportsService
} from '../../../../core/services/reports.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

const STATUSES: ReportStatus[] = ['open', 'reviewing', 'actioned', 'dismissed'];
const TARGETS = ['ai_answer', 'ad', 'job', 'blood_request', 'provider', 'rating'];
const RATING_SOURCES = ['doctor', 'pharmacy', 'lab', 'home_care', 'medical_device',
  'physical_therapy', 'employment_office', 'insurance'];
const REASONS = ['offensive', 'incorrect', 'spam', 'privacy', 'other'];

/**
 * The moderation inbox. Decisions are taken here or on the detail screen; both
 * go through the same guarded path, because "actioned" on a rating report
 * deletes the review.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports {
  private svc = inject(ReportsService);
  private dialog = inject(DialogService);
  private router = inject(Router);

  readonly statuses = STATUSES;
  readonly targets = TARGETS;
  readonly ratingSources = RATING_SOURCES;
  readonly reasons = REASONS;
  readonly perPage = 25;

  loading = signal(true);
  loadError = signal<string | null>(null);
  rows = signal<Report[]>([]);
  total = signal(0);
  page = signal(1);
  busy = signal<number | null>(null);

  statusFilter = signal<string>('open');
  targetFilter = signal<string>('');
  sourceFilter = signal<string>('');
  reasonFilter = signal<string>('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .list({
        page: this.page(),
        per_page: this.perPage,
        status: (this.statusFilter() || undefined) as ReportStatus | undefined,
        target_type: (this.targetFilter() || undefined) as never,
        // Only meaningful alongside rating reports; harmless otherwise.
        rating_source: (this.sourceFilter() || undefined) as never,
        reason: (this.reasonFilter() || undefined) as never
      })
      .subscribe({
        next: r => {
          this.rows.set(r.items);
          this.total.set(r.pagination?.total ?? r.items.length);
          this.loading.set(false);
        },
        error: () => { this.loadError.set('reports.load_failed'); this.loading.set(false); }
      });
  }

  setFilter(which: 'status' | 'target' | 'source' | 'reason', value: string): void {
    ({ status: this.statusFilter, target: this.targetFilter, source: this.sourceFilter, reason: this.reasonFilter })[which].set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  open(row: Report): void {
    this.router.navigate(['/dashboard/reports', row.id]);
  }

  isRating(row: Report): boolean {
    return row.target_type === 'rating';
  }

  /** Stars as a short string; the snapshot keeps the number. */
  stars(row: Report): string {
    const n = Number(row.target_snapshot?.rating ?? 0);
    return n > 0 ? '★'.repeat(Math.min(5, n)) + '☆'.repeat(Math.max(0, 5 - n)) : '—';
  }

  comment(row: Report): string {
    return (row.target_snapshot?.comment as string) || '—';
  }

  // ---------------------------------------------------------------- decide

  /**
   * One guarded path for every decision. Removing a review cannot be undone and
   * also closes the sibling reports on the same review, so it asks first and
   * the list is reloaded rather than patched.
   */
  async decide(row: Report, status: ReportStatus, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (status === 'actioned' && this.isRating(row)) {
      const ok = await this.dialog.confirm({
        title: 'reports.confirm_remove_title',
        text: 'reports.confirm_remove_text',
        confirmText: 'reports.remove_review',
        danger: true
      });
      if (!ok) return;
    }

    this.busy.set(row.id);
    this.svc.decide(row.id, status).subscribe({
      next: res => {
        this.busy.set(null);
        if (status === 'actioned' && this.isRating(row)) {
          this.dialog.toast('success',
            res.review_removed ? 'reports.review_removed' : 'reports.review_already_gone');
        } else {
          this.dialog.toast('success', 'reports.decision_saved');
        }
        // Siblings on the same review changed status too, so nothing local is
        // trustworthy any more.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.dialog.error('reports.decision_failed', err.error?.message ?? 'dialog.try_again');
      }
    });
  }
}
