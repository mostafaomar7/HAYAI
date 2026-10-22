import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AiTokenRequest,
  AiTokenRequestsService
} from '../../../../../core/services/ai-token-requests.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { apiErrorText } from '../../../../../shared/utils/api-error.util';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';

/** The API's own ceiling on the note the patient is shown. */
const NOTE_MAX = 500;

/**
 * One token request, and the decision.
 *
 * This is the screen the bell links to (`/dashboard/ai/token-requests/{id}`),
 * so it has to stand on its own with no list behind it.
 *
 * Two numbers are deliberately both on screen: what the allowance looked like
 * when the request was raised, and what the balance is **now**. They drift —
 * a request sitting for a week may already have been answered by the monthly
 * renewal, and granting on top of that is money spent for nothing.
 */
@Component({
  selector: 'app-ai-token-request-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, CanManageDirective],
  templateUrl: './ai-token-request-detail.html',
  styleUrl: './ai-token-request-detail.css'
})
export class AiTokenRequestDetail {
  private svc = inject(AiTokenRequestsService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly noteMax = NOTE_MAX;

  loading = signal(true);
  notFound = signal(false);
  saving = signal(false);
  request = signal<AiTokenRequest | null>(null);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});

  tokens = signal('');
  endsAt = signal('');
  adminNote = signal('');

  /** Today, so the date field cannot offer a past expiry the API will refuse. */
  readonly minDate = new Date().toISOString().slice(0, 10);

  pending = computed(() => this.request()?.status === 'pending');

  tokensValue = computed(() => {
    const n = Number(this.tokens().trim());
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
  });
  tokensInvalid = computed(() => {
    const v = this.tokensValue();
    return !Number.isFinite(v) || v < 1;
  });
  noteTooLong = computed(() => this.adminNote().length > NOTE_MAX);
  canApprove = computed(() => !this.saving() && !this.tokensInvalid() && !this.noteTooLong());

  /**
   * The allowance may have renewed since the request was raised. Worth saying
   * out loud rather than leaving two numbers to be compared by eye.
   */
  alreadyHasTokens = computed(() => {
    const now = this.request()?.current_balance?.available_tokens;
    return typeof now === 'number' && now > 0;
  });

  constructor() {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = Number(raw);
    if (!raw || !Number.isFinite(id)) { this.loading.set(false); this.notFound.set(true); return; }
    this.load(id);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: r => {
        this.request.set(r);
        // Pre-filled from the account type's allowance, which can be null or
        // 0 — in which case the admin types a number rather than being given
        // "0" to approve by accident.
        const s = r.suggested_tokens;
        this.tokens.set(typeof s === 'number' && s > 0 ? String(s) : '');
        this.adminNote.set('');
        this.endsAt.set('');
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 404) this.notFound.set(true);
        else this.formError.set(apiErrorText(err, 'ai.requests.load_failed'));
      }
    });
  }

  back(): void { this.router.navigate(['/dashboard/ai/token-requests']); }

  setTokens(v: string): void { this.tokens.set(v); }
  setEndsAt(v: string): void { this.endsAt.set(v); }
  setAdminNote(v: string): void { this.adminNote.set(v); }

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  /** Same rule as the queue: translated when known, as it arrived when not. */
  typeKey(): string {
    const type = (this.request()?.user?.user_type || '').trim();
    if (!type) return '—';
    return type === 'patient' || type === 'tourist' ? `ai.requests.type.${type}` : type;
  }

  who(): string {
    const u = this.request()?.user;
    if (!u) return '—';
    return (u.name || '').trim() || u.phone || u.email || `#${u.id}`;
  }

  async approve(): Promise<void> {
    const r = this.request();
    if (!r || !this.canApprove()) return;

    // The brief asks for this, and it is right: the number is real AI spend,
    // and it is typed into a field that was pre-filled.
    const ok = await this.dialog.confirm({
      title: 'ai.requests.approve_confirm_title',
      text: 'ai.requests.approve_confirm_text',
      confirmText: 'ai.requests.approve',
      params: { count: this.tokensValue(), name: this.who() }
    });
    if (!ok) return;

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});
    this.svc
      .approve(r.id, {
        tokens: this.tokensValue(),
        ends_at: this.endsAt().trim() || null,
        admin_note: this.adminNote().trim() || undefined
      })
      .subscribe({
        next: updated => {
          this.saving.set(false);
          this.request.set({ ...r, ...updated });
          this.dialog.toast('success', 'ai.requests.approved_toast');
        },
        error: (err: HttpErrorResponse) => this.handleError(err, r.id)
      });
  }

  async reject(): Promise<void> {
    const r = this.request();
    if (!r || this.saving()) return;
    if (this.noteTooLong()) return;

    const ok = await this.dialog.confirm({
      title: 'ai.requests.reject_confirm_title',
      text: 'ai.requests.reject_confirm_text',
      confirmText: 'common.reject',
      danger: true,
      params: { name: this.who() }
    });
    if (!ok) return;

    this.saving.set(true);
    this.formError.set(null);
    this.svc.reject(r.id, this.adminNote().trim() || undefined).subscribe({
      next: updated => {
        this.saving.set(false);
        this.request.set({ ...r, ...updated });
        this.dialog.toast('success', 'ai.requests.rejected_toast');
      },
      error: (err: HttpErrorResponse) => this.handleError(err, r.id)
    });
  }

  /**
   * A 409 is not a failure: somebody else reviewed it first, or this was a
   * double click. Reloading shows the decision that won, which is more use
   * than an error the admin has to interpret.
   */
  private handleError(err: HttpErrorResponse, id: number): void {
    this.saving.set(false);
    const code = (err.error as { error_code?: string } | null)?.error_code;
    if (err.status === 409 || code === 'AI_TOKEN_REQUEST_ALREADY_REVIEWED') {
      this.dialog.info('ai.requests.already_reviewed_title', 'ai.requests.already_reviewed_text');
      this.load(id);
      return;
    }
    const errors = (err.error as { errors?: Record<string, string[]> } | null)?.errors;
    if (err.status === 422 && errors) {
      const bag: Record<string, string> = {};
      for (const [k, v] of Object.entries(errors)) bag[k] = v?.[0] ?? '';
      this.fieldErrors.set(bag);
    }
    this.formError.set(apiErrorText(err, 'ai.requests.save_failed'));
  }
}
