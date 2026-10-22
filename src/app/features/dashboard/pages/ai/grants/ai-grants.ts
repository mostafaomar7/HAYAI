import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AiAllocation,
  AiAllocationSource,
  AiInsightsService
} from '../../../../../core/services/ai-insights.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/**
 * Token grants: what each account was given, by whom and how much is left
 * (backend brief of 2026-10-22).
 *
 * Three sources sit in one list and mean very different things —
 * `subscription` is a doctor's plan allowance that arrives by itself,
 * `purchase` was paid for, and `admin_grant` is somebody here deciding to
 * spend money. The filter exists so the third can be read on its own.
 *
 * A grant made here notifies nobody. A patient who asked through the app is
 * answered from the token-request queue instead, which tells them and records
 * the note they read.
 */
@Component({
  selector: 'app-ai-grants',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, CanManageDirective, PaginationComponent],
  templateUrl: './ai-grants.html',
  styleUrls: ['../../website/shared/website.shared.css', './ai-grants.css']
})
export class AiGrants {
  private svc = inject(AiInsightsService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly sources: AiAllocationSource[] = ['admin_grant', 'purchase', 'subscription'];

  loading = signal(true);
  failed = signal(false);
  items = signal<AiAllocation[]>([]);
  total = signal(0);

  source = signal<'' | AiAllocationSource>('');
  userId = signal<number | null>(null);
  userName = signal('');
  /** From an approved request: the row worth pointing at. */
  highlight = signal<number | null>(null);

  readonly perPage = 15;
  page = signal(1);

  // ---- the grant form ----
  formOpen = signal(false);
  saving = signal(false);
  formError = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fUser = signal('');
  fTokens = signal('');
  fEndsAt = signal('');
  fNotes = signal('');

  readonly notesMax = 500;
  readonly minDate = new Date().toISOString().slice(0, 10);

  constructor() {
    this.route.queryParamMap.subscribe(q => {
      const s = q.get('source') as AiAllocationSource | null;
      this.source.set(s && this.sources.includes(s) ? s : '');
      const u = Number(q.get('user_id'));
      this.userId.set(Number.isFinite(u) && u > 0 ? u : null);
      this.userName.set(q.get('user_name') || '');
      const h = Number(q.get('highlight'));
      this.highlight.set(Number.isFinite(h) && h > 0 ? h : null);
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      // Arriving for one account is the moment the account is already chosen.
      if (this.userId() && !this.fUser()) this.fUser.set(String(this.userId()));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.allocations({
      ...(this.source() ? { source: this.source() as AiAllocationSource } : {}),
      ...(this.userId() ? { user_id: this.userId()! } : {}),
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => {
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  private navigate(patch: Record<string, string | number | null>): void {
    const current: Record<string, string | number | null> = {
      source: this.source() || null,
      user_id: this.userId(),
      user_name: this.userName() || null,
      highlight: this.highlight(),
      page: this.page() > 1 ? this.page() : null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...current, page: null, ...patch }
    });
  }

  setSource(v: string): void { this.navigate({ source: v || null }); }
  clearUser(): void { this.navigate({ user_id: null, user_name: null, highlight: null }); }
  goToPage(page: number): void { this.navigate({ page: page > 1 ? page : null }); }

  // ---------------------------------------------------------------- form

  openForm(): void {
    this.formOpen.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.fTokens.set('');
    this.fEndsAt.set('');
    this.fNotes.set('');
  }

  setUser(v: string): void { this.fUser.set(v); }
  setTokens(v: string): void { this.fTokens.set(v); }
  setEndsAt(v: string): void { this.fEndsAt.set(v); }
  setNotes(v: string): void { this.fNotes.set(v); }

  private asInt(v: string): number {
    const n = Number(String(v).trim());
    return Number.isInteger(n) ? n : NaN;
  }

  userValue = computed(() => this.asInt(this.fUser()));
  tokensValue = computed(() => this.asInt(this.fTokens()));
  notesTooLong = computed(() => this.fNotes().length > this.notesMax);

  canSubmit = computed(() =>
    !this.saving() &&
    this.userValue() > 0 &&
    this.tokensValue() > 0 &&
    !this.notesTooLong()
  );

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    // Real AI spend, and nobody is told it happened. Worth a stop.
    const ok = await this.dialog.confirm({
      title: 'ai.grants.confirm_title',
      text: 'ai.grants.confirm_text',
      confirmText: 'ai.grants.submit',
      params: { count: this.tokensValue(), id: this.userValue() }
    });
    if (!ok) return;

    this.saving.set(true);
    this.formError.set(null);
    this.fieldErrors.set({});
    this.svc.createAllocation({
      user_id: this.userValue(),
      tokens: this.tokensValue(),
      ends_at: this.fEndsAt().trim() || null,
      notes: this.fNotes().trim() || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.dialog.toast('success', 'ai.grants.created_toast');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const errors = (err.error as { errors?: Record<string, string[]> } | null)?.errors;
        if (err.status === 422 && errors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(errors)) flat[k] = Array.isArray(v) ? v[0] : String(v);
          this.fieldErrors.set(flat);
          return;
        }
        this.formError.set(
          (err.error as { message?: string } | null)?.message || 'ai.grants.save_failed'
        );
      }
    });
  }

  // ---------------------------------------------------------------- render

  who(a: AiAllocation): string {
    const u = a.user;
    if (!u) return '—';
    return (u.name || '').trim() || `#${u.id}`;
  }

  /**
   * The account type, translated when it is one we know and printed as it
   * arrived when it is not. Grants reach doctors as well as patients, so the
   * list here is wider than the token queue's.
   */
  typeKey(a: AiAllocation): string {
    const type = (a.user?.user_type || '').trim();
    if (!type) return '';
    return ['patient', 'tourist', 'doctor'].includes(type)
      ? `ai.requests.type.${type}`
      : type;
  }

  sourceKey(a: AiAllocation): string {
    const s = String(a.source || '');
    return this.sources.includes(s as AiAllocationSource) ? `ai.grants.source.${s}` : (s || '—');
  }

  sourceClass(a: AiAllocation): string {
    const s = String(a.source || '');
    if (s === 'admin_grant') return 'pill-approved';
    if (s === 'purchase') return 'pill-ok';
    return 'pill-draft';
  }

  /** `Token request #12. …` — the request this grant came from, if any. */
  requestId(a: AiAllocation): number | null {
    const m = /^Token request #(\d+)\./.exec(a.notes || '');
    return m ? Number(m[1]) : null;
  }

  usedPercent(a: AiAllocation): number {
    const total = a.tokens ?? 0;
    if (!total) return 0;
    return Math.min(100, Math.round(((a.consumed_tokens ?? 0) / total) * 100));
  }

  num(v: number | null | undefined): string {
    return typeof v === 'number' ? v.toLocaleString('en') : '—';
  }

  usageParams(a: AiAllocation): Record<string, string> {
    return { user_id: String(a.user?.id ?? ''), user_name: this.who(a) };
  }
}
