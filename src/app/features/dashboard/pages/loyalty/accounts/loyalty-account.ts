import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  ENTRY_TYPES,
  EntryType,
  LoyaltyAccount,
  LoyaltyEntry,
  LoyaltyService,
  fieldErrorsOf,
  messageOf
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { LoyaltyPage, numOrNull } from '../loyalty-shared';

/**
 * One member's points: balance, what is about to expire, the lifetime totals,
 * the ledger, and a manual adjustment.
 *
 * The account is created on first read, so a member who never earned shows
 * 0 rather than a 404.
 */
@Component({
  selector: 'app-loyalty-account',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './loyalty-account.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyAccountPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  readonly entryTypes = ENTRY_TYPES;
  readonly perPage = 20;

  userId = Number(this.route.snapshot.paramMap.get('userId'));

  loading = signal(true);
  failed = signal(false);
  account = signal<LoyaltyAccount | null>(null);

  entries = signal<LoyaltyEntry[]>([]);
  entriesLoading = signal(true);
  entriesFailed = signal(false);
  total = signal(0);
  page = signal(1);
  type = signal<'' | EntryType>('');

  // ---- adjust ----
  adjustOpen = signal(false);
  aDirection = signal<'give' | 'take'>('give');
  aPoints = signal('');
  aReason = signal('');
  aNeverExpires = signal(false);
  adjusting = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  constructor() {
    super();
    this.load();
    this.loadEntries();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.account(this.userId).subscribe({
      next: a => { this.account.set(a); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  loadEntries(): void {
    this.entriesLoading.set(true);
    this.entriesFailed.set(false);
    this.svc.entries(this.userId, { type: this.type() || null, page: this.page(), per_page: this.perPage }).subscribe({
      next: r => { this.entries.set(r.items); this.total.set(r.pagination.total); this.entriesLoading.set(false); },
      error: () => { this.entries.set([]); this.total.set(0); this.entriesFailed.set(true); this.entriesLoading.set(false); }
    });
  }

  setType(v: string): void { this.type.set(v as EntryType | ''); this.page.set(1); this.loadEntries(); }
  goToPage(p: number): void { this.page.set(p); this.loadEntries(); }
  back(): void { this.location.back(); }

  displayName = computed(() => {
    const u = this.account()?.user;
    return (u?.name || '').trim() || `#${this.userId}`;
  });

  entryTitle(e: LoyaltyEntry): string {
    return this.pick(e) || (e.title || '').trim() || (e.event ?? '') || '—';
  }

  entryTypeLabel(e: LoyaltyEntry): string {
    return this.label(e.type_label, `loyalty.entry.${e.type}`);
  }

  entryClass(e: LoyaltyEntry): string {
    return { earn: 'pill-active', redeem: 'pill-redeemed', refund: 'pill-scheduled', expire: 'pill-expired', adjust: 'pill-unsettled' }[e.type] ?? '';
  }

  // ---------------------------------------------------------------- adjust

  openAdjust(): void {
    this.aDirection.set('give');
    this.aPoints.set('');
    this.aReason.set('');
    this.aNeverExpires.set(false);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.adjustOpen.set(true);
  }

  closeAdjust(): void { this.adjustOpen.set(false); }

  signedPoints = computed(() => {
    const n = numOrNull(this.aPoints());
    if (n === null || isNaN(n) || n <= 0 || !Number.isInteger(n)) return null;
    return this.aDirection() === 'give' ? n : -n;
  });

  /** Taking more than the member holds is refused by the server; say it first. */
  tooMuch = computed(() => {
    const n = this.signedPoints();
    return n !== null && n < 0 && -n > (this.account()?.balance ?? 0);
  });

  canAdjust = computed(() => !this.adjusting() && this.signedPoints() !== null && !this.tooMuch() && !!this.aReason().trim());

  async submitAdjust(): Promise<void> {
    const pts = this.signedPoints();
    if (!this.canAdjust() || pts === null) return;
    const ok = await this.dialog.confirm({
      title: pts > 0 ? 'loyalty.adjust.confirm_give' : 'loyalty.adjust.confirm_take',
      text: 'loyalty.adjust.confirm_text',
      confirmText: 'common.confirm',
      danger: pts < 0,
      params: { n: Math.abs(pts).toLocaleString('en'), name: this.displayName(), reason: this.aReason().trim() }
    });
    if (!ok) return;
    this.adjusting.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.svc.adjust(this.userId, { points: pts, reason: this.aReason().trim(), never_expires: pts > 0 && this.aNeverExpires() }).subscribe({
      next: r => {
        this.adjusting.set(false);
        this.adjustOpen.set(false);
        this.dialog.toast('success', 'loyalty.adjust.done');
        const a = this.account();
        if (a && typeof r?.balance === 'number') {
          const pv = a.balance ? a.balance_value / a.balance : null;
          this.account.set({ ...a, balance: r.balance, balance_value: pv !== null ? r.balance * pv : a.balance_value });
        }
        // The value and lifetime totals come from the server, so read them again.
        this.load();
        this.page.set(1);
        this.loadEntries();
      },
      error: err => {
        this.adjusting.set(false);
        const fe = fieldErrorsOf(err);
        if (fe) { this.fieldErrors.set(fe); return; }
        this.formError.set(messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  vouchersParams(): Record<string, string | number> {
    return { user_id: this.userId, user_name: this.displayName() };
  }
}
