import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { DialogService } from '../../../../../../core/services/dialog.service';
import { WebsiteApiService, errorMessage } from '../../../../../../core/services/website/website-api.service';
import { Locale, PreviewToken } from '../../../../../../core/services/website/website.models';
import { fmtDate } from '../../shared/website-utils';
import { humanize } from './page-shared';

/** Data keys that usually carry a block's visible headline, in order of preference. */
const HEADLINE_KEYS = ['headline', 'title', 'heading', 'question', 'label', 'text', 'name'];

/**
 * Structured preview of the working copy (§2.11 / §18.2).
 *
 * The dashboard does not try to look like the website — the SSR site owns
 * that. It shows what search engines and answer engines will read (SERP
 * snippet, H1, direct answer, robots / canonical / hreflang, JSON-LD) and
 * hands out a 60-minute link to the real rendered page for everything visual.
 */
@Component({
  selector: 'app-page-preview-tab',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './page-preview-tab.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './editor-tabs.css']
})
export class PagePreviewTab {
  private api = inject(WebsiteApiService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  pageId = input.required<number>();
  locale = input.required<Locale>();

  data = signal<any | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  token = signal<PreviewToken | null>(null);
  tokenLoading = signal(false);
  copied = signal(false);

  schemaPretty = computed(() => {
    const raw = this.data()?.schema_script;
    if (!raw) return this.data()?.schema ? JSON.stringify(this.data().schema, null, 2) : '';
    try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return String(raw); }
  });
  sections = computed(() => ((this.data()?.sections ?? []) as any[]).map(s => ({
    id: s.id, type: s.type, anchor: s.anchor, text: this.headline(s?.data)
  })));
  alternates = computed(() => (this.data()?.seo?.alternates ?? []) as { hreflang: string; href: string }[]);
  dir = computed(() => this.data()?.dir ?? (this.locale() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const [id, locale] = [this.pageId(), this.locale()];
      untracked(() => {
        this.token.set(null);
        this.load(id, locale);
      });
    });
  }

  refresh(): void {
    this.load(this.pageId(), this.locale());
  }

  private load(id: number, locale: Locale): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.preview('pages', id, locale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: err => {
        this.data.set(null);
        this.error.set(errorMessage(err, 'web.pages.preview_failed'));
        this.loading.set(false);
      }
    });
  }

  makeLink(): void {
    this.tokenLoading.set(true);
    this.copied.set(false);
    this.api.previewToken(this.pageId(), this.locale()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: t => { this.token.set(t); this.tokenLoading.set(false); },
      error: err => {
        this.tokenLoading.set(false);
        this.dialog.error('common.error', errorMessage(err, 'web.pages.preview_link_failed'));
      }
    });
  }

  copyLink(): void {
    const url = this.token()?.preview_url;
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => { this.copied.set(true); setTimeout(() => this.copied.set(false), 2000); },
      () => this.dialog.error('common.error', 'web.pages.copy_failed')
    );
  }

  expiry(): string {
    return fmtDate(this.token()?.expires_at, this.i18n.lang() as Locale, true);
  }

  date(value: string | null | undefined): string {
    return fmtDate(value, this.i18n.lang() as Locale, true);
  }

  blockName(type: string): string {
    return humanize(type);
  }

  /** The first headline-ish string in a block's data, so the outline reads like the page. */
  private headline(data: Record<string, any> | null | undefined): string {
    if (!data || typeof data !== 'object') return '';
    for (const k of HEADLINE_KEYS) {
      const v = data[k];
      if (typeof v === 'string' && v.trim()) return this.strip(v);
    }
    for (const v of Object.values(data)) {
      if (typeof v === 'string' && v.trim() && !/^https?:\/\//.test(v)) return this.strip(v);
    }
    return '';
  }

  private strip(v: string): string {
    const t = v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > 120 ? t.slice(0, 120) + '…' : t;
  }
}
