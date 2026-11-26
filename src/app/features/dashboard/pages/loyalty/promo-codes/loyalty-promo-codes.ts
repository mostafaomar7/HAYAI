import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  LoyaltyPromoBody,
  LoyaltyPromoCode,
  LoyaltyService,
  PROMO_STATUSES,
  PromoStatus,
  RULE_AUDIENCES,
  RuleAudience,
  fieldErrorsOf,
  messageOf,
  normaliseCode
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { LoyaltyPage, isoToLocal, localToIso, numOrNull } from '../loyalty-shared';

/**
 * Promo codes for advertisers and influencers (2026-11-26). A member types
 * the code in the app and gets its points at once. Separate from "Invite a
 * friend", which does not change.
 *
 * The filters live in the URL. A code that was used is never deleted for
 * real: the server archives it (history kept, the text stays taken), so the
 * delete dialog offers switching it off as the reversible choice.
 */
@Component({
  selector: 'app-loyalty-promo-codes',
  standalone: true,
  imports: [CommonModule, TPipe, RouterLink, CanManageDirective, PaginationComponent],
  templateUrl: './loyalty-promo-codes.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyPromoCodesPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statuses = PROMO_STATUSES;
  readonly audiences = RULE_AUDIENCES;
  readonly perPage = 20;

  loading = signal(true);
  failed = signal(false);
  items = signal<LoyaltyPromoCode[]>([]);
  total = signal(0);
  busy = signal<Set<number>>(new Set());
  copied = signal<number | null>(null);

  search = signal('');
  status = signal<'' | PromoStatus>('');
  audienceFilter = signal<'' | RuleAudience>('');
  page = signal(1);

  onSearch = debounce((v: string) => this.navigate({ search: v.trim() || null }));

  // ---- the form ----
  formOpen = signal(false);
  editing = signal<LoyaltyPromoCode | null>(null);
  saving = signal(false);
  tried = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);
  code = signal('');
  owner = signal('');
  points = signal('');
  maxUses = signal('');
  maxAge = signal('');
  audience = signal<RuleAudience>('all');
  active = signal(true);
  startsAt = signal('');
  endsAt = signal('');
  titleEn = signal('');
  titleAr = signal('');
  note = signal('');

  constructor() {
    super();
    this.route.queryParamMap.subscribe(q => {
      this.search.set(q.get('search') || '');
      const s = q.get('status') as PromoStatus | null;
      this.status.set(s && PROMO_STATUSES.includes(s) ? s : '');
      const a = q.get('audience') as RuleAudience | null;
      this.audienceFilter.set(a && RULE_AUDIENCES.includes(a) ? a : '');
      this.page.set(Math.max(1, Number(q.get('page')) || 1));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.promoCodes({
      search: this.search() || null,
      status: this.status() || null,
      audience: this.audienceFilter() || null,
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.pagination.total); this.loading.set(false); },
      error: () => { this.items.set([]); this.total.set(0); this.failed.set(true); this.loading.set(false); }
    });
  }

  private navigate(patch: Record<string, string | number | null>): void {
    const current = {
      search: this.search() || null,
      status: this.status() || null,
      audience: this.audienceFilter() || null
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: { ...current, page: null, ...patch } });
  }

  setStatus(v: string): void { this.navigate({ status: v || null }); }
  setAudience(v: string): void { this.navigate({ audience: v || null }); }
  goToPage(p: number): void { this.navigate({ page: p > 1 ? p : null }); }

  usesText(p: LoyaltyPromoCode): string {
    return `${this.num(p.uses_count)} / ${p.max_uses === null ? '∞' : this.num(p.max_uses)}`;
  }

  async copy(p: LoyaltyPromoCode): Promise<void> {
    try {
      await navigator.clipboard.writeText(p.code);
      this.copied.set(p.id);
      setTimeout(() => this.copied() === p.id && this.copied.set(null), 1500);
    } catch {
      this.dialog.toast('error', 'loyalty.promo.copy_failed');
    }
  }

  private setBusy(id: number, on: boolean): void {
    const s = new Set(this.busy());
    if (on) s.add(id); else s.delete(id);
    this.busy.set(s);
  }

  toggle(p: LoyaltyPromoCode, box: HTMLInputElement): void {
    if (!this.canManage()) { box.checked = p.is_active; return; }
    const next = box.checked;
    this.setBusy(p.id, true);
    this.svc.updatePromoCode(p.id, { is_active: next }).subscribe({
      next: updated => {
        this.setBusy(p.id, false);
        this.items.update(list => list.map(x => (x.id === p.id ? { ...x, ...updated, is_active: updated?.is_active ?? next } : x)));
        this.dialog.toast('success', next ? 'loyalty.promo.switched_on' : 'loyalty.promo.switched_off');
      },
      error: err => {
        this.setBusy(p.id, false);
        box.checked = p.is_active;
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  /**
   * Delete, with "switch it off" as the reversible choice. A used code is
   * archived by the server (`purged: false`), an unused one removed.
   */
  async remove(p: LoyaltyPromoCode): Promise<void> {
    const params = { code: p.code, n: this.num(p.uses_count) };
    if (p.is_active) {
      const pickd = await this.dialog.choose({
        title: 'loyalty.promo.delete_title',
        text: p.uses_count ? 'loyalty.promo.offer_off_used' : 'loyalty.promo.offer_off',
        confirmText: 'loyalty.promo.switch_off_instead',
        denyText: 'loyalty.promo.delete_anyway',
        params
      });
      if (pickd === null) return;
      if (pickd === 'confirm') {
        this.setBusy(p.id, true);
        this.svc.updatePromoCode(p.id, { is_active: false }).subscribe({
          next: updated => {
            this.setBusy(p.id, false);
            this.items.update(list => list.map(x => (x.id === p.id ? { ...x, ...updated, is_active: false } : x)));
            this.dialog.toast('success', 'loyalty.promo.switched_off');
          },
          error: err => { this.setBusy(p.id, false); this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed')); }
        });
        return;
      }
      // "Delete anyway" was the explicit choice: no second dialog.
      return this.doDelete(p);
    }
    const ok = await this.dialog.confirm({
      title: 'loyalty.promo.delete_title',
      text: p.uses_count ? 'loyalty.promo.delete_text_used' : 'loyalty.promo.delete_text',
      confirmText: 'common.delete',
      danger: true,
      params
    });
    if (ok) this.doDelete(p);
  }

  private doDelete(p: LoyaltyPromoCode): void {
    this.setBusy(p.id, true);
    this.svc.deletePromoCode(p.id).subscribe({
      next: r => {
        this.setBusy(p.id, false);
        this.dialog.toast('success', r?.purged === false ? 'loyalty.promo.archived' : 'loyalty.promo.deleted');
        this.load();
      },
      error: err => { this.setBusy(p.id, false); this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed')); }
    });
  }

  // ---------------------------------------------------------------- the form

  openNew(): void {
    this.editing.set(null);
    this.code.set(''); this.owner.set(''); this.points.set('');
    this.maxUses.set(''); this.maxAge.set('');
    this.audience.set('all'); this.active.set(true);
    this.startsAt.set(''); this.endsAt.set('');
    this.titleEn.set(''); this.titleAr.set(''); this.note.set('');
    this.openForm();
  }

  openEdit(p: LoyaltyPromoCode): void {
    this.editing.set(p);
    this.code.set(p.code);
    this.owner.set(p.owner_name ?? '');
    this.points.set(String(p.points ?? ''));
    this.maxUses.set(p.max_uses === null ? '' : String(p.max_uses));
    this.maxAge.set(p.max_account_age_days === null ? '' : String(p.max_account_age_days));
    this.audience.set(p.audience ?? 'all');
    this.active.set(!!p.is_active);
    this.startsAt.set(isoToLocal(p.starts_at));
    this.endsAt.set(isoToLocal(p.ends_at));
    this.titleEn.set(p.title_en ?? ''); this.titleAr.set(p.title_ar ?? '');
    this.note.set(p.note ?? '');
    this.openForm();
  }

  private openForm(): void {
    this.tried.set(false);
    this.fieldErrors.set({});
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void { this.formOpen.set(false); }

  /** Upper case and without spaces or dashes as it is typed: what the server stores. */
  typeCode(input: HTMLInputElement): void {
    const v = normaliseCode(input.value);
    input.value = v;
    this.set('code', this.code, v);
  }

  /** Typing in a field clears the server's complaint about it. */
  set(field: string, sig: { set(v: string): void }, value: string): void {
    sig.set(value);
    if (this.fieldErrors()[field]) {
      const { [field]: _, ...rest } = this.fieldErrors();
      this.fieldErrors.set(rest);
    }
  }

  clientErrors = computed(() => {
    const e: Record<string, string> = {};
    const int = (n: number | null, lo: number, hi: number) => n !== null && Number.isInteger(n) && n >= lo && n <= hi;
    const code = this.code();
    if (code && !/^[A-Z0-9]{3,32}$/.test(code)) e['code'] = 'loyalty.promo.err.code';
    if (!this.owner().trim()) e['owner_name'] = 'loyalty.promo.err.owner';
    else if (this.owner().trim().length > 191) e['owner_name'] = 'loyalty.promo.err.too_long';
    if (!int(numOrNull(this.points()), 1, 1_000_000)) e['points'] = 'loyalty.promo.err.points';
    const mu = numOrNull(this.maxUses());
    if (mu !== null && !int(mu, 1, Number.MAX_SAFE_INTEGER)) e['max_uses'] = 'loyalty.promo.err.max_uses';
    const age = numOrNull(this.maxAge());
    if (age !== null && !int(age, 1, 3650)) e['max_account_age_days'] = 'loyalty.promo.err.age';
    if (this.startsAt() && this.endsAt() && this.endsAt() <= this.startsAt()) e['ends_at'] = 'loyalty.rules.err.ends_at';
    if (this.titleEn().trim().length > 191) e['title_en'] = 'loyalty.promo.err.too_long';
    if (this.titleAr().trim().length > 191) e['title_ar'] = 'loyalty.promo.err.too_long';
    if (this.note().trim().length > 500) e['note'] = 'loyalty.promo.err.note';
    return e;
  });

  shownError(field: string): string | null {
    return this.fieldErrors()[field] ?? (this.tried() ? this.clientErrors()[field] ?? null : null);
  }

  /** Empty optional fields go as null, so an edit clears them. */
  private body(): LoyaltyPromoBody {
    return {
      code: this.code() || null,
      owner_name: this.owner().trim(),
      points: numOrNull(this.points()) ?? 0,
      max_uses: numOrNull(this.maxUses()),
      max_account_age_days: numOrNull(this.maxAge()),
      audience: this.audience(),
      is_active: this.active(),
      starts_at: localToIso(this.startsAt()),
      ends_at: localToIso(this.endsAt()),
      title_en: this.titleEn().trim() || null,
      title_ar: this.titleAr().trim() || null,
      note: this.note().trim() || null
    };
  }

  save(): void {
    this.tried.set(true);
    if (Object.keys(this.clientErrors()).length || this.saving()) return;
    const editing = this.editing();
    const body = this.body();
    // New code with an empty box: the server generates one, so `code` is left out.
    if (!editing && !body.code) delete body.code;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    const req = editing ? this.svc.updatePromoCode(editing.id, body) : this.svc.createPromoCode(body);
    req.subscribe({
      next: saved => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.dialog.toast('success', editing ? 'loyalty.saved' : 'loyalty.promo.created', { code: saved?.code ?? '' });
        this.load();
      },
      error: err => {
        this.saving.set(false);
        const fe = fieldErrorsOf(err);
        if (fe) { this.fieldErrors.set(fe); return; }
        this.formError.set(messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  /** What the member will see in their history when the titles are empty. */
  defaultTitle = computed(() => this.code() || 'CODE');
}
