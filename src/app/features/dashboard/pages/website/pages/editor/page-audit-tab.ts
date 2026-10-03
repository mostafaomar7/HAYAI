import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TPipe } from '../../../../../../core/i18n/t.pipe';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WebsiteApiService, errorMessage } from '../../../../../../core/services/website/website-api.service';
import { Locale, SeoAuditCheck, SeoAuditResult } from '../../../../../../core/services/website/website.models';
import { humanize } from './page-shared';

/**
 * SEO / GEO checklist for one language (§2.12). The backend grades the
 * working copy, so the score moves as soon as a save lands — no publish needed.
 * Failed errors first, then failed warnings, then what already passes.
 */
@Component({
  selector: 'app-page-audit-tab',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './page-audit-tab.html',
  styleUrls: ['../../shared/website.shared.css', '../../shared/editor-panel.css', './editor-tabs.css']
})
export class PageAuditTab {
  private api = inject(WebsiteApiService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  pageId = input.required<number>();
  locale = input.required<Locale>();

  result = signal<SeoAuditResult | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  checks = computed(() => {
    const rank = (c: SeoAuditCheck) => (c.passed ? 2 : c.level === 'error' ? 0 : 1);
    return [...(this.result()?.checks ?? [])].sort((a, b) => rank(a) - rank(b));
  });
  failedErrors = computed(() => this.checks().filter(c => !c.passed && c.level === 'error').length);
  failedWarnings = computed(() => this.checks().filter(c => !c.passed && c.level === 'warning').length);
  passed = computed(() => this.checks().filter(c => c.passed).length);
  scoreClass = computed(() => {
    const s = this.result()?.score ?? 0;
    return s >= 80 ? 'good' : s >= 50 ? 'fair' : 'poor';
  });

  constructor() {
    effect(() => {
      const [id, locale] = [this.pageId(), this.locale()];
      untracked(() => this.load(id, locale));
    });
  }

  refresh(): void {
    this.load(this.pageId(), this.locale());
  }

  private load(id: number, locale: Locale): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.seoAudit('pages', id, locale).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        // The endpoint returns a list (one row per language); pick ours.
        const list = Array.isArray(rows) ? rows : [rows as unknown as SeoAuditResult];
        this.result.set(list.find(r => r?.locale === locale) ?? list[0] ?? null);
        this.loading.set(false);
      },
      error: err => {
        this.result.set(null);
        this.error.set(errorMessage(err, 'web.audit_check.load_failed'));
        this.loading.set(false);
      }
    });
  }

  /** Check name: our key if we have one, otherwise the humanized backend key. */
  checkName(key: string): string {
    const k = `web.audit_check.${key}`;
    const t = this.i18n.translate(k);
    return t === k ? humanize(key) : t;
  }
}
