import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AccountDeletionRequest,
  AccountDeletionRequestsService,
  DeletionRequestStatus,
  MatchedAccount
} from '../../../../core/services/account-deletion-requests.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../shared/ui/pagination.component/pagination.component';

/**
 * Requests to delete an account, from two places at once.
 *
 * Some are typed in by a person who cannot sign in any more, and carry only an
 * email or a phone. Others come from the partner app, where pressing "Delete
 * account" already closed and hid the account and left this row behind for an
 * admin to finish. Either way the account itself is still there until someone
 * here completes the request.
 */
@Component({
  selector: 'app-account-deletion-requests',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './account-deletion-requests.html',
  styleUrl: './account-deletion-requests.css'
})
export class AccountDeletionRequests {
  private svc = inject(AccountDeletionRequestsService);
  private dialog = inject(DialogService);

  loading = signal(true);
  items = signal<AccountDeletionRequest[]>([]);
  total = signal(0);
  status = signal<DeletionRequestStatus>('pending');

  readonly perPage = 15;
  page = signal(1);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({ status: this.status(), page: this.page(), per_page: this.perPage }).subscribe({
      next: r => {
        // Handling the last row of the last page leaves us past the end.
        if (!r.items.length && this.page() > 1) {
          this.page.update(p => p - 1);
          this.load();
          return;
        }
        this.items.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setStatus(value: DeletionRequestStatus) {
    this.status.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number) { this.page.set(page); this.load(); }

  matches(r: AccountDeletionRequest): MatchedAccount[] {
    return r.matched_accounts ?? [];
  }

  /** A label an admin can tell two accounts apart by, not just an id. */
  accountLabel(a: MatchedAccount): string {
    const who = a.name?.trim() || a.email || a.phone || `#${a.id}`;
    const kind = a.user_type ? ` · ${a.user_type}` : '';
    return `${who}${kind} · #${a.id}`;
  }

  /**
   * Completing a request deletes a real account, so it asks twice: which one,
   * then the typed word.
   *
   * The account is chosen even when only one matches. A request carries an
   * email or a phone, not an id, and the same phone can belong to a patient
   * and to a provider — picking silently is how the wrong account gets
   * deleted on a match nobody looked at.
   */
  async complete(r: AccountDeletionRequest) {
    const matched = this.matches(r);
    if (!matched.length) {
      this.dialog.error('deletion_requests.no_match', 'deletion_requests.no_match_text');
      return;
    }

    const options: Record<string, string> = {};
    for (const a of matched) options[String(a.id)] = this.accountLabel(a);

    const chosen = await this.dialog.select({
      title: 'deletion_requests.pick_account',
      placeholder: 'deletion_requests.pick_account_text',
      options,
      confirmText: 'common.next'
    });
    if (!chosen) return;

    const ok = await this.dialog.confirmTyped({
      title: 'deletion_requests.complete_title',
      text: 'deletion_requests.complete_text',
      word: 'DELETE',
      confirmText: 'deletion_requests.complete_action',
      params: { account: options[chosen] }
    });
    if (!ok) return;

    this.svc.complete(r.id, { user_id: Number(chosen) }).subscribe({
      next: res => {
        this.dialog.toast('success', res.mode === 'erased'
          ? 'users.delete_account.erased_toast'
          : 'users.delete_account.deleted_toast');
        this.load();
      },
      error: err =>
        this.dialog.error('deletion_requests.complete_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /**
   * Refuses the request. Deliberately does not touch the account: one closed
   * by the partner app stays closed until somebody unblocks it from its own
   * page, which is a separate decision from refusing the paperwork.
   */
  async reject(r: AccountDeletionRequest) {
    const note = await this.dialog.prompt({
      title: 'deletion_requests.reject_title',
      text: 'deletion_requests.reject_text',
      placeholder: 'deletion_requests.note_placeholder',
      confirmText: 'deletion_requests.reject_action'
    });
    if (note === null) return;

    this.svc.reject(r.id, note.trim() || undefined).subscribe({
      next: () => {
        this.dialog.toast('success', 'deletion_requests.rejected_toast');
        this.load();
      },
      error: err =>
        this.dialog.error('deletion_requests.reject_failed', err.error?.message ?? 'dialog.try_again')
    });
  }
}
