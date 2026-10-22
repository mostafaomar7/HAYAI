import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AiTokenRequest,
  AiTokenRequestStatus,
  AiTokenRequestsService
} from '../../../../../core/services/ai-token-requests.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/**
 * Patients and tourists who ran out of their monthly AI allowance and asked
 * for more (backend brief of 2026-10-22).
 *
 * Reviewing happens on the row's own page rather than in a dialog: approving
 * takes an amount, an optional expiry and a note the patient reads, and it
 * costs real money. The list is the queue; the decision has its own screen.
 */
@Component({
  selector: 'app-ai-token-requests',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './ai-token-requests.html',
  styleUrl: './ai-token-requests.css'
})
export class AiTokenRequests {
  private svc = inject(AiTokenRequestsService);
  private router = inject(Router);

  loading = signal(true);
  failed = signal(false);
  items = signal<AiTokenRequest[]>([]);
  total = signal(0);
  /** Pending across every page, from `meta`. Not `pagination.total`. */
  pendingCount = signal<number | null>(null);
  status = signal<AiTokenRequestStatus>('pending');

  readonly perPage = 15;
  page = signal(1);

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.list({ status: this.status(), page: this.page(), per_page: this.perPage }).subscribe({
      next: r => {
        // Reviewing the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        const pending = r.meta?.['pending_count'];
        this.pendingCount.set(typeof pending === 'number' ? pending : null);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.failed.set(true);
      }
    });
  }

  setStatus(value: AiTokenRequestStatus): void {
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void { this.page.set(page); this.load(); }

  open(r: AiTokenRequest): void {
    this.router.navigate(['/dashboard/ai/token-requests', r.id]);
  }

  /** Name first, then something to tell two accounts apart by. */
  who(r: AiTokenRequest): string {
    const u = r.user;
    if (!u) return `#${r.id}`;
    return (u.name || '').trim() || u.phone || u.email || `#${u.id}`;
  }

  /**
   * "100,412 / 100,000" — over the limit is the normal case here, since that
   * is what makes someone ask. A null limit is an account type with no cap,
   * which should never produce a request; it prints as "no limit" rather than
   * as a number we do not have.
   */
  usage(r: AiTokenRequest): string {
    const used = typeof r.monthly_used === 'number' ? r.monthly_used.toLocaleString('en') : '—';
    if (r.monthly_limit === null || r.monthly_limit === undefined) return used;
    return `${used} / ${r.monthly_limit.toLocaleString('en')}`;
  }

  /**
   * The account type, as a translation key when it is one we know and as it
   * arrived when it is not. A type the API adds later should read as itself
   * rather than as a missing key, and never as a raw `patient` in an Arabic
   * table.
   */
  typeKey(r: AiTokenRequest): string {
    const type = (r.user?.user_type || '').trim();
    if (!type) return '—';
    return type === 'patient' || type === 'tourist' ? `ai.requests.type.${type}` : type;
  }

  /** Thousands separated: a grant is five or six digits. */
  grantedAmount(r: AiTokenRequest): string {
    return typeof r.granted_tokens === 'number' ? r.granted_tokens.toLocaleString('en') : '—';
  }

  noLimit(r: AiTokenRequest): boolean {
    return r.monthly_limit === null || r.monthly_limit === undefined;
  }

  reviewer(r: AiTokenRequest): string {
    const by = r.reviewed_by;
    if (!by) return '—';
    return typeof by === 'string' ? by : (by.name || `#${by.id}`);
  }
}
