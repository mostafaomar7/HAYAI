import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { LOCALES, Locale, LocaleInfo, WebsitePage } from '../../../../../core/services/website/website.models';
import { GeoEditor } from '../shared/geo-editor';
import { SeoEditor } from '../shared/seo-editor';
import { VersionsPanel } from '../shared/versions-panel';
import { fmtDate, fromLocalInput, pickLocalized, toLocalInput, translationFor } from '../shared/website-utils';
import { PageBlocks } from './blocks/page-blocks';
import { PageAuditTab } from './editor/page-audit-tab';
import { PageContentTab } from './editor/page-content-tab';
import { PageCreate } from './editor/page-create';
import { PagePreviewTab } from './editor/page-preview-tab';
import { PageRelationsTab } from './editor/page-relations-tab';
import { EditorTab, PageKind, PublishBlocker, enumLabel, kindOf, publishBlockers } from './editor/page-shared';

/** Tabs whose component holds unsaved edits that a tab / language switch would drop. */
type DirtySource = 'content' | 'blocks' | 'relations';

const TABS: EditorTab[] = ['content', 'blocks', 'seo', 'geo', 'relations', 'audit', 'versions', 'preview'];
/** Tabs that edit or show one language — they need the locale switch. */
const LOCALIZED_TABS = new Set<EditorTab>(['content', 'blocks', 'seo', 'geo', 'audit', 'preview']);

/**
 * The page / article editor (§2), and the create form on `/new`.
 *
 * Everything saved here lands in the WORKING copy; the website keeps showing
 * the last published version until Publish (§1.1). That is why the header
 * always shows `has_unpublished_changes` and the publish blockers, and why
 * the page is re-fetched after every save: both are computed server-side from
 * the working copy and go stale the moment anything is saved.
 */
@Component({
  selector: 'app-website-page-editor',
  standalone: true,
  imports: [
    CommonModule, TPipe, PageCreate, PageContentTab, PageBlocks, SeoEditor, GeoEditor,
    PageRelationsTab, PageAuditTab, VersionsPanel, PagePreviewTab
  ],
  templateUrl: './page-editor.html',
  styleUrls: ['../shared/website.shared.css', './page-editor.css']
})
export class PageEditor {
  private api = inject(WebsiteApiService);
  private ctx = inject(WebsiteContextService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  readonly kind: PageKind = this.route.snapshot.data['pageKind'] === 'articles' ? 'articles' : 'pages';
  readonly tabs = TABS;

  id = signal<number | null>(null);
  isNew = signal(false);
  page = signal<WebsitePage | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);
  /** Background refresh after a save — the editor stays visible meanwhile. */
  refreshing = signal(false);
  acting = signal<string | null>(null);

  tab = signal<EditorTab>('content');
  locale = signal<Locale>('en');
  localeInfos = signal<LocaleInfo[]>(LOCALES.map(code => ({
    code, name: code, native: code === 'ar' ? 'العربية' : 'English', dir: code === 'ar' ? 'rtl' : 'ltr', hreflang: code, is_default: code === 'en'
  })));
  private dirtyBy = signal<Record<DirtySource, boolean>>({ content: false, blocks: false, relations: false });
  dirty = computed(() => Object.values(this.dirtyBy()).some(Boolean));

  // schedule dialog
  scheduleOpen = signal(false);
  publishAt = signal('');
  unpublishAt = signal('');
  scheduleErrors = signal<Record<string, string>>({});
  scheduleError = signal<string | null>(null);

  canUpdate = computed(() => this.ctx.can('cms.update'));
  canPublish = computed(() => this.ctx.can('cms.publish'));
  canCreate = computed(() => this.ctx.can('cms.create'));
  canDelete = computed(() => this.ctx.can('cms.delete'));
  canSeo = computed(() => this.ctx.can('seo.view'));

  isArticle = computed(() => (this.page()?.type ?? (this.kind === 'articles' ? 'article' : '')) === 'article');
  lang = computed(() => this.i18n.lang() as Locale);
  title = computed(() => {
    const p = this.page();
    return p ? pickLocalized(p.translations, 'title', this.lang()) || `#${p.id}` : '';
  });
  hasLocale = computed(() => !!translationFor(this.page()?.translations, this.locale()));
  localeName = computed(() => this.localeInfos().find(l => l.code === this.locale())?.native ?? this.locale());
  blockers = computed<PublishBlocker[]>(() => publishBlockers(this.page()?.publish_errors));
  publishable = computed(() => !!this.page() && this.blockers().length === 0);
  liveLinks = computed(() => (this.page()?.translations ?? [])
    .filter(t => !!t.live_url)
    .map(t => ({ locale: t.locale, url: t.live_url!, path: `/${t.locale}/${t.published_path ?? ''}`.replace(/\/+$/, '') })));
  hasSchedule = computed(() => !!(this.page()?.publish_at || this.page()?.unpublish_at));
  showLocaleSwitch = computed(() => LOCALIZED_TABS.has(this.tab()));
  /** Languages that exist but are switched off — they will not publish. */
  disabledLocales = computed(() => (this.page()?.translations ?? []).filter(t => t.is_enabled === false).map(t => t.locale));

  constructor() {
    this.ctx.enums().pipe(takeUntilDestroyed()).subscribe({
      next: e => { if (e.locales?.length) this.localeInfos.set(e.locales); },
      error: () => {}
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const raw = params.get('id');
      if (!raw) {
        this.isNew.set(true);
        this.loading.set(false);
        return;
      }
      const id = Number(raw);
      this.isNew.set(false);
      this.id.set(id);
      const qLocale = this.route.snapshot.queryParamMap.get('locale');
      const qTab = this.route.snapshot.queryParamMap.get('tab') as EditorTab | null;
      if (qTab && TABS.includes(qTab)) this.tab.set(qTab);
      this.load(id, qLocale === 'en' || qLocale === 'ar' ? qLocale : null);
    });
  }

  // ── loading ─────────────────────────────────────────────────────

  private load(id: number, preferLocale: Locale | null): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.page(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        // An article opened from /pages (or vice versa) moves to its own route,
        // so the menu highlight and the back link stay right.
        if (kindOf(p.type) !== this.kind) {
          this.router.navigate(['/dashboard/website', kindOf(p.type), p.id], { replaceUrl: true, queryParamsHandling: 'preserve' });
          return;
        }
        this.page.set(p);
        const existing = p.translations.map(t => t.locale);
        const pick = preferLocale
          ?? (existing.includes(this.lang()) ? this.lang() : existing[0] ?? 'en');
        this.locale.set(pick);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'web.pages.load_failed'));
        this.loading.set(false);
      }
    });
  }

  /** Re-fetch after any save so status, unpublished-changes and blockers stay true. */
  reload(): void {
    const id = this.id();
    if (!id) return;
    this.refreshing.set(true);
    this.api.page(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.page.set(p); this.refreshing.set(false); },
      error: () => this.refreshing.set(false)
    });
  }

  // ── tabs, languages, unsaved edits ──────────────────────────────

  setDirty(source: DirtySource, value: boolean): void {
    if (this.dirtyBy()[source] === value) return;
    this.dirtyBy.update(d => ({ ...d, [source]: value }));
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.dirty()) return true;
    const ok = await this.dialog.confirm({
      title: 'web.pages.discard_title',
      text: 'web.pages.discard_text',
      confirmText: 'web.pages.discard',
      danger: true
    });
    if (ok) this.dirtyBy.set({ content: false, blocks: false, relations: false });
    return ok;
  }

  async selectTab(tab: EditorTab, locale?: Locale | null): Promise<void> {
    if (tab === this.tab() && (!locale || locale === this.locale())) return;
    if (!(await this.confirmDiscard())) return;
    this.tab.set(tab);
    if (locale) this.locale.set(locale);
    this.syncUrl();
  }

  async selectLocale(locale: Locale): Promise<void> {
    if (locale === this.locale()) return;
    if (!(await this.confirmDiscard())) return;
    this.locale.set(locale);
    this.syncUrl();
  }

  /** Tab and language live in the URL so a reload or a shared link lands in the same place. */
  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: this.tab() === 'content' ? null : this.tab(), locale: this.locale() },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  hasTranslation(locale: Locale): boolean {
    return !!translationFor(this.page()?.translations, locale);
  }

  isDisabledLocale(locale: Locale): boolean {
    return this.disabledLocales().includes(locale);
  }

  // ── publishing (§2.8) ───────────────────────────────────────────

  async publish(): Promise<void> {
    const p = this.page();
    if (!p || !this.canPublish() || !this.publishable()) return;
    if (this.dirty()) {
      const go = await this.dialog.confirm({
        title: 'web.pages.publish_dirty_title',
        text: 'web.pages.publish_dirty_text',
        confirmText: 'web.pages.publish_anyway'
      });
      if (!go) return;
    }
    // Optional label: it names the version in the history ("Launch copy").
    const label = await this.dialog.prompt({
      title: 'web.pages.publish_title',
      text: 'web.pages.publish_text',
      placeholder: 'web.pages.publish_label_placeholder',
      confirmText: 'web.pages.publish'
    });
    if (label === null) return;
    this.act('publish', this.api.publish(p.id, label.trim() || null), 'web.pages.published');
  }

  async unpublish(): Promise<void> {
    const p = this.page();
    if (!p) return;
    const ok = await this.dialog.confirm({
      title: 'web.pages.unpublish_title',
      text: 'web.pages.unpublish_text',
      params: { name: this.title() },
      confirmText: 'web.pages.unpublish',
      danger: true
    });
    if (ok) this.act('unpublish', this.api.unpublish(p.id), 'web.pages.unpublished');
  }

  async archive(): Promise<void> {
    const p = this.page();
    if (!p) return;
    const ok = await this.dialog.confirm({
      title: 'web.pages.archive_title',
      text: 'web.pages.archive_text',
      params: { name: this.title() },
      confirmText: 'web.pages.archive',
      danger: true
    });
    if (ok) this.act('archive', this.api.archive(p.id), 'web.pages.archived');
  }

  openSchedule(): void {
    const p = this.page();
    if (!p) return;
    this.publishAt.set(toLocalInput(p.publish_at));
    this.unpublishAt.set(toLocalInput(p.unpublish_at));
    this.scheduleErrors.set({});
    this.scheduleError.set(null);
    this.scheduleOpen.set(true);
  }

  saveSchedule(): void {
    const p = this.page();
    if (!p) return;
    const pub = fromLocalInput(this.publishAt());
    const unpub = fromLocalInput(this.unpublishAt());
    const errors: Record<string, string> = {};
    const now = Date.now();
    if (!pub && !unpub) errors['publish_at'] = 'web.pages.schedule_empty';
    // The API rejects past times (publish now instead); say so before the round trip.
    if (pub && new Date(pub).getTime() <= now) errors['publish_at'] = 'web.pages.schedule_past';
    if (unpub && new Date(unpub).getTime() <= now) errors['unpublish_at'] = 'web.pages.schedule_past';
    if (pub && unpub && new Date(unpub) <= new Date(pub)) errors['unpublish_at'] = 'web.pages.schedule_order';
    this.scheduleErrors.set(errors);
    this.scheduleError.set(null);
    if (Object.keys(errors).length) return;

    this.acting.set('schedule');
    this.api.schedule(p.id, pub, unpub).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.acting.set(null);
        this.scheduleOpen.set(false);
        this.dialog.toast('success', 'web.pages.scheduled');
        this.reload();
      },
      error: err => {
        this.acting.set(null);
        this.scheduleErrors.set(fieldErrors(err));
        this.scheduleError.set(errorMessage(err, 'web.pages.action_failed'));
      }
    });
  }

  async cancelSchedule(): Promise<void> {
    const p = this.page();
    if (!p) return;
    const ok = await this.dialog.confirm({
      title: 'web.pages.cancel_schedule_title',
      text: 'web.pages.cancel_schedule_text',
      confirmText: 'web.pages.cancel_schedule'
    });
    if (ok) this.act('schedule', this.api.schedule(p.id, null, null), 'web.pages.schedule_canceled');
  }

  // ── other page actions (§2.9) ───────────────────────────────────

  duplicate(): void {
    const p = this.page();
    if (!p) return;
    this.acting.set('duplicate');
    this.api.duplicatePage(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: copy => {
        this.acting.set(null);
        this.dialog.toast('success', 'web.pages.duplicated');
        this.router.navigate(['/dashboard/website', kindOf(copy.type), copy.id]);
      },
      error: err => {
        this.acting.set(null);
        this.dialog.error('common.error', errorMessage(err, 'web.pages.action_failed'));
      }
    });
  }

  async remove(): Promise<void> {
    const p = this.page();
    if (!p) return;
    const ok = await this.dialog.confirm({
      title: 'web.pages.trash_title',
      text: 'web.pages.trash_text',
      params: { name: this.title() },
      confirmText: 'web.pages.move_to_trash',
      danger: true
    });
    if (!ok) return;
    this.acting.set('delete');
    this.api.deletePage(p.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.acting.set(null);
        this.dirtyBy.set({ content: false, blocks: false, relations: false });
        this.dialog.toast('success', 'web.pages.trashed');
        this.back();
      },
      error: err => {
        this.acting.set(null);
        this.dialog.error('common.error', errorMessage(err, 'web.pages.action_failed'));
      }
    });
  }

  /**
   * Runs a page action, then re-reads the page. A 422 on publish lists every
   * blocker; the refreshed `publish_errors` puts them in the header list, and
   * the backend message explains the refusal.
   */
  private act(name: string, call: Observable<unknown>, successKey: string): void {
    this.acting.set(name);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.acting.set(null);
        this.dialog.toast('success', successKey);
        this.reload();
      },
      error: err => {
        this.acting.set(null);
        this.reload();
        this.dialog.error('common.error', errorMessage(err, 'web.pages.action_failed'));
      }
    });
  }

  back(): void {
    this.router.navigate(['/dashboard/website', this.kind]);
  }

  // ── display ─────────────────────────────────────────────────────

  typeLabel(type: string): string {
    return enumLabel(this.i18n, 'page_type', type);
  }

  statusLabel(p: WebsitePage): string {
    return enumLabel(this.i18n, 'content_status', p.status, p.status_label);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.lang(), true);
  }

  localeLabel(locale: Locale | null): string {
    if (!locale) return '';
    return this.localeInfos().find(l => l.code === locale)?.native ?? locale.toUpperCase();
  }
}
