import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { UserListBase } from '../user-list.base';
import { TouristItem, UserResource } from '../../../../../core/services/users.service';
import { SettingsService } from '../../../../../core/services/settings.service';
import { LookupsService } from '../../../../../core/services/lookups.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/** '' = everyone, 'false' = the queue, 'true' = already verified. */
type VerifiedTab = '' | 'true' | 'false';

/**
 * Tourists, opening on the verification queue.
 *
 * A tourist may browse at once, but a medical-tourism or doctor request waits
 * until an admin confirms on WhatsApp that they really live abroad. Every
 * account that existed before the rule shipped starts unverified, so the queue
 * is the screen that matters and it is the tab that opens first.
 */
@Component({
  selector: 'app-tourists',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './tourists.html',
  styleUrl: './tourists.css'
})
export class Tourists extends UserListBase<TouristItem> {
  override resource: UserResource = 'tourists';

  private settings = inject(SettingsService);
  private lookups = inject(LookupsService);

  verifiedTab = signal<VerifiedTab>('false');
  /** Badge on the queue tab; null until the first count comes back. */
  pendingCount = signal<number | null>(null);
  /**
   * Null while unknown. When the platform switch is off nothing is gated, and
   * the screen says so rather than implying the queue is blocking anyone.
   */
  verificationRequired = signal<boolean | null>(null);
  /** The account number a tourist quotes to support; search does not match ids. */
  openId = signal('');
  openIdError = signal<string | null>(null);

  countriesLoaded = signal(false);
  private countries = signal<{ code: string; name: string }[]>([]);

  gatingOff = computed(() => this.verificationRequired() === false);

  constructor() {
    super();
    this.init();
    this.loadPendingCount();
    this.loadSwitch();
  }

  /** The queue filter rides along with whatever the shared filters already send. */
  protected override extraQuery(): Record<string, unknown> {
    return { verified: this.verifiedTab() || undefined };
  }

  private loadPendingCount(): void {
    this.svc.list<TouristItem>('tourists', { per_page: 1, verified: 'false' }).subscribe({
      next: r => this.pendingCount.set(r.pagination?.total ?? 0),
      error: () => this.pendingCount.set(null)
    });
  }

  private loadSwitch(): void {
    this.settings.list().subscribe({
      next: rows => {
        const row = rows.find(r => r.key === 'tourists.verification_required');
        this.verificationRequired.set(row ? row.value === true : null);
      },
      // The banner is extra context; failing to read it must not break the list.
      error: () => this.verificationRequired.set(null)
    });
  }

  setTab(tab: VerifiedTab): void {
    if (this.verifiedTab() === tab) return;
    this.verifiedTab.set(tab);
    this.page.set(1);
    this.load();
  }

  // ------------------------------------------------------------- row helpers

  isVerified(user: TouristItem): boolean {
    return user.verification?.verified === true;
  }

  /** wa.me wants digits only — no `+`, spaces or dashes. */
  whatsappLink(user: TouristItem): string | null {
    const digits = `${user.country_code ?? ''}${user.phone ?? ''}`.replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }

  phoneLabel(user: TouristItem): string {
    return `${user.country_code ?? ''} ${user.phone ?? ''}`.trim() || '—';
  }

  // ---------------------------------------------------------------- open #id

  async openById(): Promise<void> {
    const id = Number(this.openId().replace('#', '').trim());
    if (!Number.isInteger(id) || id <= 0) {
      this.openIdError.set('tourists.open_id_invalid');
      return;
    }
    this.openIdError.set(null);
    this.svc.get<TouristItem>('tourists', id).subscribe({
      next: row => {
        // Showing the one row beats filtering a list that cannot search by id.
        this.items.set([row]);
        this.total.set(1);
        this.page.set(1);
      },
      error: (err: HttpErrorResponse) =>
        this.openIdError.set(err.status === 404 ? 'tourists.open_id_missing' : 'dialog.try_again')
    });
  }

  clearOpenId(): void {
    this.openId.set('');
    this.openIdError.set(null);
    this.load();
  }

  // ----------------------------------------------------------------- actions

  private async pickCountry(current: string | null): Promise<string | null | undefined> {
    if (!this.countriesLoaded()) {
      const rows = await new Promise<{ code: string; name: string }[]>(resolve => {
        this.lookups.countries().subscribe({
          next: list => resolve(list.map(c => ({
            code: String(c['iso2'] ?? c.code ?? c.id),
            name: String(c.name ?? c.label ?? c['iso2'])
          }))),
          error: () => resolve([])
        });
      });
      // Egypt is refused by the API on purpose: someone living in Egypt needs a
      // patient account, so it is not offered as a choice at all.
      this.countries.set(rows.filter(c => c.code.toUpperCase() !== 'EG'));
      this.countriesLoaded.set(true);
    }
    const options: Record<string, string> = {};
    for (const c of this.countries()) options[c.code] = c.name;
    if (!Object.keys(options).length) return null;

    // `select` takes no body text, so the explanation rides in the title line
    // it already shows; Egypt is simply absent from the options.
    return this.dialog.select({
      title: 'tourists.verify_country_title',
      options,
      defaultValue: current ?? undefined,
      confirmText: 'common.continue'
    });
  }

  async verify(user: TouristItem): Promise<void> {
    this.openActionMenuId = null;
    const country = await this.pickCountry(user.residence_country ?? null);
    if (country === undefined || country === null || country === '') return;

    const note = await this.dialog.prompt({
      title: 'tourists.verify_title',
      text: 'tourists.verify_text',
      params: { name: user.name },
      placeholder: 'tourists.verify_note_placeholder',
      confirmText: 'tourists.verify'
    });
    if (note === null) return;

    this.svc.verifyTourist(user.id, { residence_country: country, note: note || undefined }).subscribe({
      next: row => {
        this.replaceRow(row);
        this.dialog.toast('success', 'tourists.verified');
        this.loadPendingCount();
      },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('tourists.verify_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  async unverify(user: TouristItem): Promise<void> {
    this.openActionMenuId = null;
    const note = await this.dialog.prompt({
      title: 'tourists.unverify_title',
      text: 'tourists.unverify_text',
      params: { name: user.name },
      placeholder: 'tourists.verify_note_placeholder',
      confirmText: 'tourists.unverify'
    });
    if (note === null) return;

    this.svc.unverifyTourist(user.id, { note: note || undefined }).subscribe({
      next: row => {
        this.replaceRow(row);
        this.dialog.toast('success', 'tourists.unverified');
        this.loadPendingCount();
      },
      error: (err: HttpErrorResponse) =>
        this.dialog.error('tourists.verify_failed', err.error?.message ?? 'dialog.try_again')
    });
  }

  /**
   * The API returns the updated row, so it replaces the old one in place — and
   * drops out of the list when it no longer belongs on the open tab.
   */
  private replaceRow(row: TouristItem): void {
    const tab = this.verifiedTab();
    const stillBelongs = tab === '' || (tab === 'true') === (row.verification?.verified === true);
    this.items.update(list => stillBelongs
      ? list.map(r => (r.id === row.id ? row : r))
      : list.filter(r => r.id !== row.id));
    if (!stillBelongs) this.total.update(t => Math.max(0, t - 1));
  }
}
