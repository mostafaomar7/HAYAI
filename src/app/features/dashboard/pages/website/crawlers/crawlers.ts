import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import {
  CrawlerVisibility, LlmsEntry, LlmsEntryInput, ResolvedUrl, RobotsRule, RobotsRuleInput, SitemapInfo
} from '../../../../../core/services/website/website.models';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { fmtDate, joinLines, lines, nullIfEmpty } from '../shared/website-utils';

type CrawlerTab = 'robots' | 'llms' | 'sitemap' | 'ai' | 'checker';

interface RuleDraft {
  user_agent: string;
  allow: string;
  disallow: string;
  block_all: boolean;
  crawl_delay: string;
  is_enabled: boolean;
  notes: string;
}

interface LlmsDraft {
  section: string;
  title: string;
  url: string;
  description: string;
  sort_order: number;
}

type LlmsPreview = { content: string; sections: unknown; excluded: { id: number; title: string; url: string; reason: string }[] };

/**
 * User agents of AI assistants and AI search. Blocking one removes HAYAI from
 * that assistant's answers (and, for Google-Extended, from Gemini grounding),
 * which is the opposite of what the GEO work on every page is for — so the
 * editor makes the admin confirm it explicitly.
 */
const AI_CRAWLERS = [
  'gptbot', 'chatgpt-user', 'oai-searchbot', 'claudebot', 'claude-user', 'claude-searchbot',
  'perplexitybot', 'perplexity-user', 'google-extended', 'ccbot'
];

/**
 * Sitemap / robots / llms.txt / AI-crawler visibility / URL checker
 * (§13.3–13.7). One screen with tabs because these are the "how do search
 * engines and AI assistants see the site" tools and are used together.
 * Reading needs seo.view (the route guard); every change needs seo.update and
 * the crawler-visits tab needs analytics.view, so tabs and buttons follow that.
 */
@Component({
  selector: 'app-website-crawlers',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, RouterLink],
  templateUrl: './crawlers.html',
  styleUrls: ['../shared/website.shared.css', './crawlers.css']
})
export class Crawlers {
  private api = inject(WebsiteApiService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  readonly ctx = inject(WebsiteContextService);

  readonly tabs = computed<CrawlerTab[]>(() => {
    const list: CrawlerTab[] = ['robots', 'llms', 'sitemap'];
    if (this.ctx.can('analytics.view')) list.push('ai');
    list.push('checker');
    return list;
  });
  tab = signal<CrawlerTab>('robots');
  readonly canEdit = computed(() => this.ctx.can('seo.update'));

  // ── robots ──
  rules = signal<RobotsRule[]>([]);
  rulesLoading = signal(false);
  rulesError = signal<string | null>(null);
  robotsPreview = signal<{ content: string; private_paths: string[] } | null>(null);
  ruleModal = signal(false);
  editingRule = signal<RobotsRule | null>(null);
  ruleDraft = signal<RuleDraft>(this.blankRule());

  // ── llms ──
  entries = signal<LlmsEntry[]>([]);
  llmsLoading = signal(false);
  llmsError = signal<string | null>(null);
  llmsPreview = signal<LlmsPreview | null>(null);
  entryModal = signal(false);
  editingEntry = signal<LlmsEntry | null>(null);
  entryDraft = signal<LlmsDraft>(this.blankEntry());
  /** Entries grouped by section in their sort order, as the file lists them. */
  readonly sections = computed(() => {
    const groups = new Map<string, LlmsEntry[]>();
    const sorted = [...this.entries()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const e of sorted) {
      const key = e.section || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });
  readonly sectionNames = computed(() => this.sections().map(s => s.name).filter(n => n !== '—'));

  // ── sitemap ──
  sitemap = signal<SitemapInfo | null>(null);
  sitemapLoading = signal(false);
  sitemapError = signal<string | null>(null);

  // ── AI crawler visibility ──
  readonly windows = [7, 14, 30];
  days = signal(14);
  visibility = signal<CrawlerVisibility | null>(null);
  visLoading = signal(false);
  visError = signal<string | null>(null);

  // ── URL checker ──
  checkUrl = signal('');
  checking = signal(false);
  resolved = signal<ResolvedUrl | null>(null);

  // shared modal state
  saving = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  private loaded = new Set<CrawlerTab>();

  constructor() {
    // `?tab=` keeps the open tab across reloads and lets other screens deep-link (e.g. settings → llms).
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const wanted = q.get('tab') as CrawlerTab | null;
      const next = wanted && this.tabs().includes(wanted) ? wanted : this.tab();
      this.tab.set(next);
      this.ensureLoaded(next);
    });
  }

  selectTab(tab: CrawlerTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
  }

  private ensureLoaded(tab: CrawlerTab): void {
    if (this.loaded.has(tab)) return;
    this.loaded.add(tab);
    if (tab === 'robots') this.loadRobots();
    if (tab === 'llms') this.loadLlms();
    if (tab === 'sitemap') this.loadSitemap();
    if (tab === 'ai') this.loadVisibility();
  }

  // ════════════════════════ robots.txt ════════════════════════

  loadRobots(): void {
    this.rulesLoading.set(true);
    this.rulesError.set(null);
    this.api.robotsRules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.rules.set(rows ?? []);
        this.rulesLoading.set(false);
      },
      error: err => {
        this.rulesError.set(errorMessage(err, 'web.crawlers.load_failed'));
        this.rulesLoading.set(false);
      }
    });
    this.refreshRobotsPreview();
  }

  private refreshRobotsPreview(): void {
    this.api.robotsPreview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => this.robotsPreview.set({ content: p?.content ?? '', private_paths: p?.private_paths ?? [] }),
      error: () => this.robotsPreview.set(null)
    });
  }

  isAiCrawler(userAgent: string | null | undefined): boolean {
    return AI_CRAWLERS.includes((userAgent ?? '').trim().toLowerCase());
  }

  private blankRule(): RuleDraft {
    return { user_agent: '', allow: '/', disallow: '', block_all: false, crawl_delay: '', is_enabled: true, notes: '' };
  }

  openRule(rule: RobotsRule | null): void {
    this.editingRule.set(rule);
    this.ruleDraft.set(rule
      ? {
          user_agent: rule.user_agent,
          allow: joinLines(rule.allow),
          disallow: joinLines(rule.disallow),
          block_all: !!rule.block_all,
          crawl_delay: rule.crawl_delay === null || rule.crawl_delay === undefined ? '' : String(rule.crawl_delay),
          is_enabled: rule.is_enabled !== false,
          notes: rule.notes ?? ''
        }
      : this.blankRule());
    this.resetErrors();
    this.ruleModal.set(true);
  }

  patchRule<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]): void {
    this.ruleDraft.update(d => ({ ...d, [key]: value }));
  }

  async saveRule(): Promise<void> {
    const d = this.ruleDraft();
    const editing = this.editingRule();
    const wasBlocked = !!editing?.block_all;

    // Only warn on the transition to blocked — re-saving an already blocked
    // group (to fix its notes, say) should not nag every time.
    if (d.block_all && !wasBlocked && this.isAiCrawler(d.user_agent)) {
      const ok = await this.dialog.confirm({
        title: 'web.crawlers.block_ai_title',
        text: 'web.crawlers.block_ai_text',
        params: { agent: d.user_agent.trim() },
        confirmText: 'web.crawlers.block_ai_confirm',
        icon: 'error',
        danger: true
      });
      if (!ok) return;
    }

    const delay = d.crawl_delay.trim();
    const body: RobotsRuleInput = {
      user_agent: d.user_agent.trim(),
      allow: lines(d.allow),
      disallow: lines(d.disallow),
      block_all: d.block_all,
      crawl_delay: delay === '' ? null : Number(delay),
      is_enabled: d.is_enabled,
      notes: nullIfEmpty(d.notes)
    };
    this.saving.set(true);
    this.resetErrors();
    const req = editing ? this.api.updateRobotsRule(editing.id, body) : this.api.createRobotsRule(body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.ruleModal.set(false);
        this.dialog.toast('success', 'common.saved');
        this.loadRobots();
      },
      error: err => this.onSaveError(err)
    });
  }

  async deleteRule(rule: RobotsRule): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.crawlers.delete_rule_title',
      text: 'web.crawlers.delete_rule_text',
      params: { agent: rule.user_agent },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteRobotsRule(rule.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'common.deleted');
        this.loadRobots();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.crawlers.delete_failed'))
    });
  }

  // ════════════════════════ llms.txt ════════════════════════

  loadLlms(): void {
    this.llmsLoading.set(true);
    this.llmsError.set(null);
    this.api.llmsEntries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.entries.set(rows ?? []);
        this.llmsLoading.set(false);
      },
      error: err => {
        this.llmsError.set(errorMessage(err, 'web.crawlers.load_failed'));
        this.llmsLoading.set(false);
      }
    });
    this.api.llmsPreview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => this.llmsPreview.set({ content: p?.content ?? '', sections: p?.sections, excluded: p?.excluded ?? [] }),
      error: () => this.llmsPreview.set(null)
    });
  }

  private blankEntry(): LlmsDraft {
    return { section: '', title: '', url: '', description: '', sort_order: 0 };
  }

  openEntry(entry: LlmsEntry | null, section?: string): void {
    this.editingEntry.set(entry);
    this.entryDraft.set(entry
      ? {
          section: entry.section ?? '',
          title: entry.title ?? '',
          url: entry.url ?? '',
          description: entry.description ?? '',
          sort_order: entry.sort_order ?? 0
        }
      : { ...this.blankEntry(), section: section ?? '' });
    this.resetErrors();
    this.entryModal.set(true);
  }

  patchEntry<K extends keyof LlmsDraft>(key: K, value: LlmsDraft[K]): void {
    this.entryDraft.update(d => ({ ...d, [key]: value }));
  }

  saveEntry(): void {
    const d = this.entryDraft();
    const editing = this.editingEntry();
    const body: LlmsEntryInput = {
      section: d.section.trim(),
      title: d.title.trim(),
      url: d.url.trim(),
      description: nullIfEmpty(d.description),
      sort_order: Number(d.sort_order) || 0
    };
    this.saving.set(true);
    this.resetErrors();
    const req = editing ? this.api.updateLlmsEntry(editing.id, body) : this.api.createLlmsEntry(body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.entryModal.set(false);
        this.dialog.toast('success', 'common.saved');
        this.loadLlms();
      },
      error: err => this.onSaveError(err)
    });
  }

  async deleteEntry(entry: LlmsEntry): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.crawlers.delete_entry_title',
      text: 'web.crawlers.delete_entry_text',
      params: { title: entry.title },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteLlmsEntry(entry.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'common.deleted');
        this.loadLlms();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.crawlers.delete_failed'))
    });
  }

  isExcluded(entry: LlmsEntry): string | null {
    return this.llmsPreview()?.excluded?.find(x => x.id === entry.id)?.reason ?? null;
  }

  // ════════════════════════ sitemap ════════════════════════

  loadSitemap(): void {
    this.sitemapLoading.set(true);
    this.sitemapError.set(null);
    this.api.sitemap().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => {
        this.sitemap.set(s);
        this.sitemapLoading.set(false);
      },
      error: err => {
        this.sitemapError.set(errorMessage(err, 'web.crawlers.load_failed'));
        this.sitemapLoading.set(false);
      }
    });
  }

  entriesOf(map: Record<string, number> | null | undefined): { key: string; value: number }[] {
    return Object.entries(map ?? {}).map(([key, value]) => ({ key, value }));
  }

  // ════════════════════════ AI crawler visibility ════════════════════════

  setDays(days: number): void {
    this.days.set(Number(days));
    this.loadVisibility();
  }

  loadVisibility(): void {
    this.visLoading.set(true);
    this.visError.set(null);
    this.api.crawlers(this.days()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => {
        this.visibility.set(v);
        this.visLoading.set(false);
      },
      error: err => {
        this.visError.set(errorMessage(err, 'web.crawlers.load_failed'));
        this.visLoading.set(false);
      }
    });
  }

  /** Google-Extended is a robots.txt token only — Google crawls as Googlebot, so it never "visits". */
  isTokenOnly(crawler: string): boolean {
    return crawler.trim().toLowerCase() === 'google-extended';
  }

  // ════════════════════════ URL checker ════════════════════════

  check(): void {
    const url = this.checkUrl().trim();
    if (!url) return;
    this.checking.set(true);
    this.api.resolveUrl(url).subscribe({
      next: r => {
        this.resolved.set(r);
        this.checking.set(false);
      },
      error: err => {
        this.checking.set(false);
        this.resolved.set(null);
        this.dialog.error('common.error', errorMessage(err, 'web.crawlers.check_failed'));
      }
    });
  }

  /** Reason codes are snake_case machine values; show a translation when we have one. */
  reasonLabel(reason: string | null | undefined): string {
    if (!reason) return '—';
    const key = `web.crawlers.reason.${reason}`;
    const t = this.i18n.translate(key);
    return t === key ? reason.replace(/_/g, ' ') : t;
  }

  // ── shared ──

  closeModals(): void {
    if (this.saving()) return;
    this.ruleModal.set(false);
    this.entryModal.set(false);
  }

  private resetErrors(): void {
    this.errors.set({});
    this.formError.set(null);
  }

  private onSaveError(err: any): void {
    this.saving.set(false);
    if (err?.status === 422) {
      this.errors.set(fieldErrors(err));
      this.formError.set(errorMessage(err, 'web.crawlers.save_failed'));
    } else {
      this.dialog.error('common.error', errorMessage(err, 'web.crawlers.save_failed'));
    }
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang(), true);
  }

  /** Field errors on list fields come back as `allow.0`; show the first under the textarea. */
  listError(field: string): string | null {
    const e = this.errors();
    if (e[field]) return e[field];
    const k = Object.keys(e).find(x => x.startsWith(field + '.'));
    return k ? e[k] : null;
  }
}
