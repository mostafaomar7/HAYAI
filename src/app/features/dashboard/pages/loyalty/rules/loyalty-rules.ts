import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../../../core/services/dialog.service';
import {
  LIMIT_PERIODS,
  LOYALTY_GROUPS,
  LimitPeriod,
  LoyaltyEvent,
  LoyaltyRule,
  LoyaltyRuleBody,
  LoyaltyService,
  RULE_AUDIENCES,
  RULE_STATUSES,
  RuleAudience,
  RuleStatus,
  fieldErrorsOf,
  messageOf
} from '../../../../../core/services/loyalty.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { LoyaltyPage, isoToLocal, localToIso, numOrNull } from '../loyalty-shared';

interface RuleGroup { group: string; rows: LoyaltyRule[]; }

/**
 * What each action earns, and when.
 *
 * A rule without dates is the standing value of its action; a dated one is a
 * campaign that wins while it runs. Exactly one rule pays per action — the
 * running one that started latest — so the page lists every rule of an action
 * together and says which one is paying now.
 *
 * The list is small (one seeded rule per action plus campaigns), so it is
 * loaded whole and grouped here rather than paged.
 */
@Component({
  selector: 'app-loyalty-rules',
  standalone: true,
  imports: [CommonModule, TPipe, CanManageDirective],
  templateUrl: './loyalty-rules.html',
  styleUrls: ['../../website/shared/website.shared.css', '../loyalty.css']
})
export class LoyaltyRulesPage extends LoyaltyPage {
  private svc = inject(LoyaltyService);
  private dialog = inject(DialogService);

  readonly statuses = RULE_STATUSES;
  readonly audiences = RULE_AUDIENCES;
  readonly periods = LIMIT_PERIODS;

  events = signal<LoyaltyEvent[]>([]);
  rules = signal<LoyaltyRule[]>([]);
  loading = signal(true);
  failed = signal(false);
  busy = signal<Set<number>>(new Set());

  fEvent = signal('');
  fStatus = signal<'' | RuleStatus>('');
  fAudience = signal<'' | RuleAudience>('');

  // ---- the form ----
  formOpen = signal(false);
  editing = signal<LoyaltyRule | null>(null);
  saving = signal(false);
  fieldErrors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);
  ev = signal('');
  points = signal('');
  perEgp = signal('');
  maxPoints = signal('');
  limitCount = signal('');
  limitPeriod = signal<'' | LimitPeriod>('');
  audience = signal<RuleAudience>('all');
  active = signal(true);
  startsAt = signal('');
  endsAt = signal('');
  titleEn = signal('');
  titleAr = signal('');
  descEn = signal('');
  descAr = signal('');

  constructor() {
    super();
    this.svc.events().subscribe({ next: e => this.events.set(e), error: () => this.events.set([]) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.svc.rules({
      event: this.fEvent() || null,
      status: this.fStatus() || null,
      audience: this.fAudience() || null,
      per_page: 100
    }).subscribe({
      next: r => { this.rules.set(r.items); this.loading.set(false); },
      error: () => { this.rules.set([]); this.failed.set(true); this.loading.set(false); }
    });
  }

  setFilter(which: 'event' | 'status' | 'audience', v: string): void {
    if (which === 'event') this.fEvent.set(v);
    if (which === 'status') this.fStatus.set(v as RuleStatus | '');
    if (which === 'audience') this.fAudience.set(v as RuleAudience | '');
    this.load();
  }

  eventOf(key: string | null | undefined): LoyaltyEvent | undefined {
    return this.events().find(e => e.event === key);
  }

  /** Grouped as the catalogue groups them, actions in catalogue order. */
  groups = computed<RuleGroup[]>(() => {
    const order = this.events().map(e => e.event);
    const rank = (r: LoyaltyRule) => { const i = order.indexOf(r.event); return i < 0 ? 999 : i; };
    const byGroup = new Map<string, LoyaltyRule[]>();
    for (const r of this.rules()) {
      const g = String(this.eventOf(r.event)?.group ?? 'other');
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(r);
    }
    const keys = [...LOYALTY_GROUPS.filter(g => byGroup.has(g)), ...[...byGroup.keys()].filter(g => !LOYALTY_GROUPS.includes(g as never))];
    return keys.map(group => ({
      group,
      rows: byGroup.get(group)!.sort((a, b) => rank(a) - rank(b) || (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || a.id - b.id)
    }));
  });

  groupKey(g: string): string {
    return LOYALTY_GROUPS.includes(g as never) ? `loyalty.group.${g}` : g;
  }

  actionTitle(r: LoyaltyRule): string {
    return this.pick(r) || this.pick(r, 'event_title') || this.pick(this.eventOf(r.event)) || r.event;
  }

  /** The rule's own title when it has one, under the action's name. */
  hasOwnTitle(r: LoyaltyRule): boolean {
    return !!this.pick(r);
  }

  statusLabel(r: LoyaltyRule): string {
    return this.label(r.rule_status_label, `loyalty.rules.status.${r.rule_status}`);
  }

  limitText(r: LoyaltyRule): string {
    if (r.kind === 'once') return this.i18n.translate('loyalty.rules.once');
    if (!r.limit_count) return this.i18n.translate('loyalty.rules.no_limit');
    return this.i18n.translate('loyalty.rules.limit_text', {
      n: r.limit_count,
      period: this.i18n.translate(`loyalty.rules.period.${r.limit_period}`)
    });
  }

  // ---------------------------------------------------------------- toggle / delete

  private setBusy(id: number, on: boolean): void {
    const s = new Set(this.busy());
    if (on) s.add(id); else s.delete(id);
    this.busy.set(s);
  }

  toggle(r: LoyaltyRule, box: HTMLInputElement): void {
    if (!this.canManage()) { box.checked = r.is_active; return; }
    const next = box.checked;
    this.setBusy(r.id, true);
    this.svc.updateRule(r.id, { is_active: next }).subscribe({
      next: updated => {
        this.setBusy(r.id, false);
        this.rules.update(list => list.map(x => x.id === r.id ? { ...x, ...updated, is_active: updated?.is_active ?? next } : x));
        this.dialog.toast('success', next ? 'loyalty.rules.switched_on' : 'loyalty.rules.switched_off');
      },
      error: err => {
        this.setBusy(r.id, false);
        box.checked = r.is_active;
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  async remove(r: LoyaltyRule): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'loyalty.rules.delete_title',
      text: 'loyalty.rules.delete_text',
      confirmText: 'common.delete',
      danger: true,
      params: { name: this.actionTitle(r) }
    });
    if (!ok) return;
    this.setBusy(r.id, true);
    this.svc.deleteRule(r.id).subscribe({
      next: () => {
        this.setBusy(r.id, false);
        this.rules.update(list => list.filter(x => x.id !== r.id));
        this.dialog.toast('success', 'loyalty.rules.deleted');
      },
      error: err => {
        this.setBusy(r.id, false);
        this.dialog.error('loyalty.save_failed', messageOf(err, 'loyalty.save_failed'));
      }
    });
  }

  // ---------------------------------------------------------------- the form

  formEvent = computed(() => this.eventOf(this.ev()));
  showAmount = computed(() => !!this.formEvent()?.supports_amount);
  showLimit = computed(() => this.formEvent()?.kind !== 'once');

  openNew(eventKey = ''): void {
    this.editing.set(null);
    this.ev.set(eventKey || this.fEvent() || '');
    this.points.set('');
    this.perEgp.set('');
    this.maxPoints.set('');
    this.limitCount.set('');
    this.limitPeriod.set('');
    this.audience.set('all');
    this.active.set(true);
    this.startsAt.set('');
    this.endsAt.set('');
    this.titleEn.set(''); this.titleAr.set(''); this.descEn.set(''); this.descAr.set('');
    this.openForm();
  }

  openEdit(r: LoyaltyRule): void {
    this.editing.set(r);
    this.ev.set(r.event);
    this.points.set(String(r.points ?? ''));
    this.perEgp.set(r.points_per_egp === null ? '' : String(r.points_per_egp));
    this.maxPoints.set(r.max_points === null ? '' : String(r.max_points));
    this.limitCount.set(r.limit_count === null ? '' : String(r.limit_count));
    this.limitPeriod.set(r.limit_period ?? '');
    this.audience.set(r.audience ?? 'all');
    this.active.set(!!r.is_active);
    this.startsAt.set(isoToLocal(r.starts_at));
    this.endsAt.set(isoToLocal(r.ends_at));
    this.titleEn.set(r.title_en ?? ''); this.titleAr.set(r.title_ar ?? '');
    this.descEn.set(r.description_en ?? ''); this.descAr.set(r.description_ar ?? '');
    this.openForm();
  }

  private openForm(): void {
    this.fieldErrors.set({});
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  /** The obvious mistakes, said before the server says them. */
  clientErrors = computed(() => {
    const e: Record<string, string> = {};
    if (!this.ev()) e['event'] = 'loyalty.rules.err.event';
    const pts = numOrNull(this.points()) ?? 0;
    const per = this.showAmount() ? (numOrNull(this.perEgp()) ?? 0) : 0;
    if (isNaN(pts) || pts < 0 || !Number.isInteger(pts)) e['points'] = 'loyalty.rules.err.points_int';
    else if (!(pts > 0 || per > 0)) e['points'] = 'loyalty.rules.err.points';
    if (this.showAmount() && (isNaN(per) || per < 0)) e['points_per_egp'] = 'loyalty.rules.err.per_egp';
    const max = numOrNull(this.maxPoints());
    if (this.showAmount() && max !== null && (isNaN(max) || max < 1 || !Number.isInteger(max))) e['max_points'] = 'loyalty.rules.err.max';
    if (this.showLimit()) {
      const lc = numOrNull(this.limitCount());
      if (lc !== null && (isNaN(lc) || lc < 1 || !Number.isInteger(lc))) e['limit_count'] = 'loyalty.rules.err.limit_count';
      if (lc !== null && !this.limitPeriod()) e['limit_period'] = 'loyalty.rules.err.limit_period';
    }
    if (this.startsAt() && this.endsAt() && this.endsAt() <= this.startsAt()) e['ends_at'] = 'loyalty.rules.err.ends_at';
    return e;
  });

  errorFor(field: string): string | null {
    return this.fieldErrors()[field] ?? null;
  }

  /** Shown once Save was pressed, or as soon as the field has a server error. */
  tried = signal(false);
  shownError(field: string): string | null {
    return this.errorFor(field) ?? (this.tried() ? this.clientErrors()[field] ?? null : null);
  }

  private body(): LoyaltyRuleBody {
    const amount = this.showAmount();
    const limit = this.showLimit();
    const lc = limit ? numOrNull(this.limitCount()) : null;
    return {
      event: this.ev(),
      title_en: this.titleEn().trim() || null,
      title_ar: this.titleAr().trim() || null,
      description_en: this.descEn().trim() || null,
      description_ar: this.descAr().trim() || null,
      points: numOrNull(this.points()) ?? 0,
      points_per_egp: amount ? numOrNull(this.perEgp()) : null,
      max_points: amount ? numOrNull(this.maxPoints()) : null,
      limit_count: lc,
      limit_period: lc !== null ? (this.limitPeriod() || null) : null,
      audience: this.audience(),
      is_active: this.active(),
      starts_at: localToIso(this.startsAt()),
      ends_at: localToIso(this.endsAt())
    };
  }

  save(): void {
    this.tried.set(true);
    if (Object.keys(this.clientErrors()).length || this.saving()) return;
    const editing = this.editing();
    const body = this.body();
    this.saving.set(true);
    this.fieldErrors.set({});
    this.formError.set(null);
    const req = editing ? this.svc.updateRule(editing.id, body) : this.svc.createRule(body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.tried.set(false);
        this.formOpen.set(false);
        this.dialog.toast('success', 'loyalty.saved');
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

  setEvent(v: string): void {
    this.ev.set(v);
    // Clear what the new action cannot take, so it is not sent by surprise.
    if (!this.showAmount()) { this.perEgp.set(''); this.maxPoints.set(''); }
    if (!this.showLimit()) { this.limitCount.set(''); this.limitPeriod.set(''); }
  }
}
