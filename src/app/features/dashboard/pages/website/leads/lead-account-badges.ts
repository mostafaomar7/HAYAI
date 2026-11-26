import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeadAccount } from '../../../../../core/services/website/website.models';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/**
 * The HAYAI account behind a website request (brief 2026-11-26, B2): how it
 * was linked, whether the site created it, and whether the patient has opened
 * the app since. Created is not activated, so the two are separate badges.
 *
 * `link` is null on links made before the brief; the request still has an
 * account, so it says only that.
 */
@Component({
  selector: 'app-lead-account-badges',
  standalone: true,
  imports: [TPipe, RouterLink],
  template: `
    @if (account(); as a) {
      <span class="acct-badges">
        @switch (a.link) {
          @case ('verified_phone') { <span class="pill pill-completed">{{ 'web.leads.account.verified_phone' | t }}</span> }
          @case ('signed_in') { <span class="pill pill-in_progress">{{ 'web.leads.account.signed_in' | t }}</span> }
          @default { <span class="pill pill-draft">{{ 'web.leads.account.linked' | t }}</span> }
        }
        @if (a.created_on_website) { <span class="pill pill-ready">{{ 'web.leads.account.created_on_website' | t }}</span> }
        @if (a.app_activated) { <span class="pill pill-all_approved">{{ 'web.leads.account.app_activated' | t }}</span> }
        @if (detail()) {
          @if (!a.has_password) { <span class="pill pill-cost_pending">{{ 'web.leads.account.no_password' | t }}</span> }
          @if (a.user_id) {
            <a class="acct-link" [routerLink]="['/dashboard/users', a.user_id, 'activity']">{{ 'web.leads.account.open' | t: { id: a.user_id } }}</a>
          }
        }
      </span>
    } @else if (detail()) {
      <span class="text-gray">{{ 'web.leads.account.none' | t }}</span>
    }
  `,
  // The page's pill colours are encapsulated in its own stylesheet: repeated here.
  styles: [`
    .acct-badges { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .pill { display: inline-block; border-radius: 20px; padding: 2px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .pill-completed { background: #ECFDF5; color: #047857; }
    .pill-in_progress { background: #EFF6FF; color: #2563EB; }
    .pill-draft { background: #F3F4F6; color: #4B5563; }
    .pill-ready { background: #EDE9FE; color: #6D28D9; }
    .pill-all_approved { background: #E0F2FE; color: #0369A1; }
    .pill-cost_pending { background: #FEF3C7; color: #92400E; }
    .text-gray { color: #6B7280; font-size: 13px; }
    .acct-link { font-size: 13px; color: #2563EB; text-decoration: none; margin-inline-start: 4px; }
    .acct-link:hover { text-decoration: underline; }
  `]
})
export class LeadAccountBadges {
  readonly account = input<LeadAccount | null | undefined>(null);
  /** Lead detail: also the password state and the link to the account. */
  readonly detail = input(false);
}
