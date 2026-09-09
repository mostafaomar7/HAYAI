import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivityRecord,
  ActivityRecordService,
  RecordAttachment,
  RecordParty,
  StatusTone
} from '../../../../core/services/activity-record.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

const TONES: StatusTone[] = ['neutral', 'info', 'success', 'warning', 'danger'];

/**
 * Any record an activity row points at — all 21 types, one screen.
 *
 * It renders the envelope rather than the record: sections, parties and amounts
 * arrive already labelled and formatted, so nothing here knows what a pharmacy
 * order or an ICU request is. That is the whole point — a type added to the app
 * later shows up here with no change to this file.
 */
@Component({
  selector: 'app-activity-record',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './activity-record.html',
  styleUrl: './activity-record.css'
})
export class ActivityRecordPage {
  private svc = inject(ActivityRecordService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  record = signal<ActivityRecord | null>(null);
  loading = signal(true);
  /** An i18n key. `gone` is a real state here, not a failure — see `load`. */
  loadError = signal<string | null>(null);
  openingAttachment = signal<string | null>(null);

  type = this.route.snapshot.paramMap.get('type') ?? '';
  id = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.get(this.type, this.id).pipe(takeUntilDestroyed()).subscribe({
      next: r => { this.record.set(r); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        // A 404 here is routine, not a fault: the timeline keeps its row after
        // the record behind it is deleted, so the id is real but the row is
        // gone. Saying so beats a generic failure the admin would retry.
        this.loadError.set(
          err.status === 404 ? 'activity.record.gone'
            : err.status === 422 ? 'activity.record.unknown_type'
              : 'activity.record.load_failed'
        );
        this.loading.set(false);
      }
    });
  }

  // ------------------------------------------------------------ presentation

  /** Guards the pill against a tone the backend adds after this was written. */
  tone = computed<StatusTone>(() => {
    const t = this.record()?.status?.tone;
    return t && TONES.includes(t) ? t : 'neutral';
  });

  /** A record with no lifecycle sends a null value; the pill is dropped. */
  hasStatus = computed(() => !!this.record()?.status?.value);

  /** The figure rendered large, if the type carries money at all. */
  primaryAmount = computed(() => this.record()?.amounts.find(a => a.primary) ?? null);
  otherAmounts = computed(() => this.record()?.amounts.filter(a => !a.primary) ?? []);

  /** `143` off the wire is still money, so it is shown to two places. */
  money(value: number, currency: string): string {
    return `${value.toFixed(2)} ${currency}`;
  }

  /**
   * `value` is already display-ready — the type only decides whether it becomes
   * a link. Anything unrecognised is treated as plain text so a type added later
   * degrades instead of breaking.
   */
  linkFor(type: string, value: string | null): string | null {
    if (!value) return null;
    if (type === 'phone') return 'tel:' + value;
    if (type === 'email') return 'mailto:' + value;
    if (type === 'url') return value;
    return null;
  }

  /** Only these two want the reading direction pinned; Arabic must not flip them. */
  isLatin(type: string): boolean {
    return type === 'phone' || type === 'email' || type === 'url';
  }

  // ------------------------------------------------------------------ actions

  /** Providers are named by the entity but linked to the account that owns it. */
  openParty(p: RecordParty): void {
    if (p.user_id) this.router.navigate(['/dashboard/users', p.user_id, 'activity']);
  }

  /**
   * Some attachment URLs are opaque `/files/` references that only resolve with
   * the admin's bearer token, which a new tab would not send. Pulling the blob
   * through the service puts it through the auth interceptor first.
   */
  openAttachment(a: RecordAttachment): void {
    if (this.openingAttachment()) return;
    this.openingAttachment.set(a.url);
    this.svc.fetchAttachment(a.url).subscribe({
      next: blob => {
        this.openingAttachment.set(null);
        const href = URL.createObjectURL(blob);
        window.open(href, '_blank', 'noopener');
        // The tab has the blob by now; holding the handle open leaks it.
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
      },
      error: () => {
        this.openingAttachment.set(null);
        this.dialog.error('activity.record.attachment_failed', 'dialog.try_again');
      }
    });
  }

  back(): void {
    // history.back keeps the timeline's filters and scroll position, which a
    // navigation to the list would throw away.
    if (window.history.length > 1) window.history.back();
    else this.router.navigate(['/dashboard']);
  }
}
