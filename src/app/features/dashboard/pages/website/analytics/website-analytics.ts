import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  AnalyticsEvent, AnalyticsRange, AnalyticsSummary, CampaignAnalyticsRow, CtaAnalyticsRow, PageAnalyticsRow
} from '../../../../../core/services/website/website.models';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { debounce } from '../../../../../shared/utils/debounce.util';
import { fmtDate } from '../shared/website-utils';

type AnalyticsTab = 'overview' | 'ctas' | 'pages' | 'campaigns' | 'events';

/** The events the backend counts as a conversion (§14). `purchase_completed` is logged by an admin action, not the site. */
export const CONVERSION_EVENTS = [
  'contact_submitted', 'partner_request_submitted', 'quote_requested', 'demo_requested', 'purchase_submitted'
];

/** One small-multiple line chart: its own scale so a low-volume series is still readable. */
interface TrendChart {
  key: string;
  color: string;
  max: number;
  total: number;
  line: string;
  area: string;
  points: { x: number; y: number; value: number; day: string }[];
  gridlines: { y: number; value: number }[];
}

const CHART_W = 560;
const CHART_H = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

/**
 * Website analytics & conversions (§14, analytics.view). Every report takes
 * the same `from` / `to` range (default: the last 30 days), so the range lives
 * at the top and all tabs reload with it. No chart library is installed, so
 * the daily trend is a small hand-drawn SVG.
 */
@Component({
  selector: 'app-website-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, RouterLink, PaginationComponent],
  templateUrl: './website-analytics.html',
  styleUrls: ['../shared/website.shared.css', './website-analytics.css']
})
export class WebsiteAnalytics {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly tabs: AnalyticsTab[] = ['overview', 'ctas', 'pages', 'campaigns', 'events'];
  readonly conversionEvents = CONVERSION_EVENTS;
  readonly chartW = CHART_W;
  readonly chartH = CHART_H;
  readonly pad = PAD;

  tab = signal<AnalyticsTab>('overview');
  from = signal(this.isoDay(-29));
  to = signal(this.isoDay(0));

  summary = signal<AnalyticsSummary | null>(null);
  ctas = signal<CtaAnalyticsRow[]>([]);
  pages = signal<PageAnalyticsRow[]>([]);
  campaigns = signal<CampaignAnalyticsRow[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  // raw events
  events = signal<AnalyticsEvent[]>([]);
  eventsTotal = signal(0);
  eventsPage = signal(1);
  readonly eventsPerPage = 25;
  eventsLoading = signal(false);
  eventsError = signal<string | null>(null);
  eventFilter = signal('');
  sessionFilter = signal('');
  ctaFilter = signal('');
  eventTypes = signal<string[]>([]);
  expanded = signal<number | null>(null);

  private loadedTabs = new Set<AnalyticsTab>();

  readonly funnel = computed(() => {
    const steps = this.summary()?.funnel ?? [];
    const first = steps[0]?.count || 0;
    const max = Math.max(1, ...steps.map(s => s.count || 0));
    return steps.map((s, i) => {
      const prev = i > 0 ? steps[i - 1].count || 0 : null;
      return {
        step: s.step,
        count: s.count || 0,
        width: Math.max(2, Math.round(((s.count || 0) / max) * 100)),
        ofFirst: first ? Math.round(((s.count || 0) / first) * 1000) / 10 : 0,
        // Drop-off from the previous step, the number a marketer acts on.
        dropOff: prev ? Math.round((1 - (s.count || 0) / prev) * 1000) / 10 : null
      };
    });
  });

  readonly charts = computed<TrendChart[]>(() => {
    const daily = this.summary()?.daily ?? [];
    return [
      this.buildChart(daily, 'page_view', '#2563EB'),
      this.buildChart(daily, 'cta_click', '#7C3AED')
    ];
  });

  /** About six evenly spaced day labels, whatever the range length. */
  readonly xLabels = computed(() => {
    const daily = this.summary()?.daily ?? [];
    if (!daily.length) return [];
    const step = Math.max(1, Math.ceil(daily.length / 6));
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < daily.length; i += step) {
      out.push({ x: this.xAt(i, daily.length), label: this.shortDay(String(daily[i]['day'])) });
    }
    return out;
  });

  /** Every event count in the range, largest first. */
  readonly eventCounts = computed(() =>
    Object.entries(this.summary()?.events ?? {})
      .map(([key, value]) => ({ key, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value)
  );

  onSessionFilter = debounce((v: string) => { this.sessionFilter.set(v.trim()); this.eventsPage.set(1); this.loadEvents(); });
  onCtaFilter = debounce((v: string) => { this.ctaFilter.set(v.trim()); this.eventsPage.set(1); this.loadEvents(); });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const t = q.get('tab') as AnalyticsTab | null;
      this.tab.set(t && this.tabs.includes(t) ? t : 'overview');
      this.ensureLoaded();
    });
    // The event dropdown comes from `/enums` (never hardcoded); it needs cms.view,
    // which an analyst may lack — then the filter is a free-text box instead.
    if (this.ctx.can('cms.view')) {
      this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
        next: e => this.eventTypes.set(e.analytics_events ?? []),
        error: () => this.eventTypes.set([])
      });
    }
  }

  selectTab(tab: AnalyticsTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }

  private range(): AnalyticsRange {
    return { from: this.from() || undefined, to: this.to() || undefined };
  }

  setRange(which: 'from' | 'to', value: string): void {
    (which === 'from' ? this.from : this.to).set(value);
    this.loadedTabs.clear();
    this.eventsPage.set(1);
    this.ensureLoaded();
  }

  preset(days: number): void {
    this.from.set(this.isoDay(-(days - 1)));
    this.to.set(this.isoDay(0));
    this.loadedTabs.clear();
    this.eventsPage.set(1);
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    const tab = this.tab();
    if (this.loadedTabs.has(tab)) return;
    this.loadedTabs.add(tab);
    if (tab === 'events') this.loadEvents();
    else this.loadReport(tab);
  }

  reload(): void {
    this.loadedTabs.delete(this.tab());
    this.ensureLoaded();
  }

  private loadReport(tab: Exclude<AnalyticsTab, 'events'>): void {
    this.loading.set(true);
    this.loadError.set(null);
    const r = this.range();
    const done = () => this.loading.set(false);
    const fail = (err: any) => {
      this.loadError.set(errorMessage(err, 'web.analytics.load_failed'));
      this.loadedTabs.delete(tab);
      done();
    };
    const take = takeUntilDestroyed<any>(this.destroyRef);
    switch (tab) {
      case 'overview':
        this.api.analyticsSummary(r).pipe(take).subscribe({ next: s => { this.summary.set(s); done(); }, error: fail });
        break;
      case 'ctas':
        this.api.analyticsCtas(r).pipe(take).subscribe({ next: rows => { this.ctas.set(rows ?? []); done(); }, error: fail });
        break;
      case 'pages':
        this.api.analyticsPages(r).pipe(take).subscribe({ next: rows => { this.pages.set(rows ?? []); done(); }, error: fail });
        break;
      case 'campaigns':
        this.api.analyticsCampaigns(r).pipe(take).subscribe({ next: rows => { this.campaigns.set(rows ?? []); done(); }, error: fail });
        break;
    }
  }

  loadEvents(): void {
    this.eventsLoading.set(true);
    this.eventsError.set(null);
    this.api
      .analyticsEvents({
        ...this.range(),
        page: this.eventsPage(),
        per_page: this.eventsPerPage,
        event: this.eventFilter() || undefined,
        session_id: this.sessionFilter() || undefined,
        cta_tracking_key: this.ctaFilter() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.events.set(res.items);
          this.eventsTotal.set(res.pagination.total);
          this.eventsLoading.set(false);
        },
        error: err => {
          this.events.set([]);
          this.eventsError.set(errorMessage(err, 'web.analytics.load_failed'));
          this.eventsLoading.set(false);
        }
      });
  }

  setEventFilter(value: string): void {
    this.eventFilter.set(value);
    this.eventsPage.set(1);
    this.loadEvents();
  }

  /** Clicking a session id narrows the raw events to that visitor's journey. */
  filterSession(id: string | null): void {
    if (!id) return;
    this.sessionFilter.set(id);
    this.eventsPage.set(1);
    this.loadEvents();
  }

  clearEventFilters(): void {
    this.eventFilter.set('');
    this.sessionFilter.set('');
    this.ctaFilter.set('');
    this.eventsPage.set(1);
    this.loadEvents();
  }

  goToEventsPage(p: number): void {
    this.eventsPage.set(p);
    this.loadEvents();
  }

  toggleEvent(id: number): void {
    this.expanded.update(cur => (cur === id ? null : id));
  }

  /** Every extra column of a raw event row (UTM, placement, metadata …) for the expanded view. */
  eventDetails(e: AnalyticsEvent): { key: string; value: string }[] {
    return Object.entries(e)
      .filter(([k, v]) => !['id', 'event', 'event_label'].includes(k) && v !== null && v !== undefined && v !== '')
      .map(([key, v]) => ({ key, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
  }

  // ── chart ───────────────────────────────────────────────────────

  private xAt(i: number, n: number): number {
    const inner = CHART_W - PAD.left - PAD.right;
    return PAD.left + (n <= 1 ? inner / 2 : (i / (n - 1)) * inner);
  }

  private buildChart(daily: AnalyticsSummary['daily'], key: string, color: string): TrendChart {
    const values = daily.map(d => Number(d[key]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    const max = this.niceMax(Math.max(0, ...values));
    const inner = CHART_H - PAD.top - PAD.bottom;
    const yAt = (v: number) => PAD.top + inner - (max ? (v / max) * inner : 0);
    const points = values.map((value, i) => ({ x: this.xAt(i, values.length), y: yAt(value), value, day: String(daily[i]['day']) }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const base = (PAD.top + inner).toFixed(1);
    const area = points.length
      ? `${line} L${points[points.length - 1].x.toFixed(1)},${base} L${points[0].x.toFixed(1)},${base} Z`
      : '';
    const gridlines = [0, 0.5, 1].map(f => ({ y: yAt(max * f), value: Math.round(max * f) }));
    return { key, color, max, total, line, area, points, gridlines };
  }

  /** Rounds the axis top up to 1 / 2 / 5 × 10ⁿ so gridline labels are round numbers. */
  private niceMax(v: number): number {
    if (v <= 0) return 4;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nice * exp;
  }

  // ── formatting ──────────────────────────────────────────────────

  eventLabel(event: string): string {
    const k = `web.enum.analytics_event.${event}`;
    const t = this.i18n.translate(k);
    return t === k ? event : t;
  }

  /**
   * `conversion_rate` is a percentage, 0–100 with 2 decimals (`3.75` → "3.75%"),
   * and `null` when nothing was counted to divide by — shown as a dash, not 0%.
   */
  pct(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '—';
    const n = Number(value).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
    return `${n}%`;
  }

  num(value: number | null | undefined): string {
    return (Number(value) || 0).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }

  private shortDay(day: string): string {
    const d = new Date(day);
    if (isNaN(d.getTime())) return day;
    return d.toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
  }

  private isoDay(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
