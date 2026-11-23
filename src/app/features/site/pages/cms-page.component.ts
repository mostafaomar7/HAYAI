import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Dict, PagePayload, PageSection, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { BlockRendererComponent } from '../blocks/block-renderer.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { FaqListComponent } from '../ui/faq-list.component';
import { SourcesListComponent } from '../ui/sources-list.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { arr, ctasFor, hrefOf, img, str } from '../site-utils';
import { WIDGET_ANCHORS, widgetPlan } from '../widgets/page-widgets';
import { pagePath } from '../widgets/widget-utils';
import { IcuListComponent } from '../widgets/icu-list.component';
import { DoctorDirectoryComponent, DoctorSearchComponent } from '../widgets/doctor-directory.component';
import { HospitalDirectoryComponent } from '../widgets/hospital-directory.component';
import { GuidesComponent } from '../widgets/guides.component';
import { HomeSearchComponent } from '../widgets/home-search.component';

/**
 * A CMS page (home, landing, article…) — payload §18.2, website 2026 layout.
 *
 * Crawler contract implemented here:
 *  - exactly one `<h1>`: the hero flagged as the H1 source, otherwise
 *    `h1.text` printed in the Navy page hero;
 *  - the GEO direct answer stays in the server HTML, below the fold as a
 *    collapsed "About" note (brief §06: it made Home wordy above the hero);
 *  - the byline ("By … · Published · Updated") only where `show_byline`;
 *  - FAQ / sources / CTAs in the HTML, never fetched later;
 *  - the live widgets (doctor search, hospitals, ICU, guides) are rendered
 *    from data the resolver fetched, so they are in the first HTML too.
 */
@Component({
  selector: 'site-cms-page',
  imports: [
    NgTemplateOutlet,
    BlockRendererComponent,
    BreadcrumbsComponent,
    FaqListComponent,
    SourcesListComponent,
    SiteImageComponent,
    CtaButtonComponent,
    IcuListComponent,
    DoctorSearchComponent,
    DoctorDirectoryComponent,
    HospitalDirectoryComponent,
    GuidesComponent,
    HomeSearchComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = page();
    @let w = widgets();
    @if (p.is_preview) {
      <p class="preview-banner" role="note">{{ state.t('previewBanner') }}</p>
    }

    @if (!h1Section()) {
      <header class="page-hero" [class.page-hero-legal]="legal()">
        <div class="wrap">
          @if (!hasBreadcrumbBlock()) {
            <site-breadcrumbs [items]="p.breadcrumbs ?? []" />
          }
          <h1>{{ h1Text() }}</h1>
          @if (str(p.subtitle)) {
            <p class="lead">{{ p.subtitle }}</p>
          }
          <ng-container *ngTemplateOutlet="byline" />
          @if (plan().doctors) {
            <site-doctor-search [widgets]="w" [base]="base()" />
          }
        </div>
      </header>
      @if (featured()) {
        <div class="wrap featured-img">
          <site-img [image]="featured()" [priority]="true" sizes="(min-width: 1200px) 1160px, 100vw" />
        </div>
      }
    }

    @if (plan().icu && !plan().icuAfter) {
      <site-icu-list [data]="w?.icu" [basePath]="base()" [area]="w?.query?.['area'] ?? ''" [formOnPage]="icuFormOnPage()" />
    }

    @for (s of sections(); track s.id ?? $index) {
      @if (s === plan().doctors) {
        <site-doctor-directory [widgets]="w" [section]="s" [base]="base()" />
      } @else if (s === plan().hospitals && hospitalRows()) {
        <site-hospital-directory [widgets]="w" [section]="s" [base]="base()" />
      } @else if (s === plan().guides && (articleRows() || guidesFiltered())) {
        <site-guides [widgets]="w" [section]="s" [base]="base()" />
      } @else if (s === plan().icuAfter && s.anchor === icuAnchor && icuFresh()) {
        <!-- The anchored block is the fallback: the live list replaces it. -->
        <site-icu-list [data]="w?.icu" [basePath]="base()" [area]="w?.query?.['area'] ?? ''" [formOnPage]="icuFormOnPage()" />
      } @else {
        <site-block
          [section]="s"
          [isH1]="s === h1Section()"
          [h1Text]="s === h1Section() ? h1Text() : null"
          [priority]="$first"
          [geoAnswerOnPage]="!!geoAnswer()"
          [hasAside]="s === h1Section() && plan().home && icuFresh()"
        >
          <!-- One root element per @if, so each is projected by its selector. -->
          @if (s === h1Section() && plan().home) {
            <div hero-search><site-home-search [widgets]="w" /></div>
          }
          @if (s === h1Section() && plan().home && icuFresh()) {
            <div hero-aside><site-icu-list mode="card" [data]="w?.icu" /></div>
          }
        </site-block>
        @if (s === h1Section() && showByline()) {
          <div class="wrap"><ng-container *ngTemplateOutlet="byline" /></div>
        }
        @if (s === plan().icuAfter && s.anchor !== icuAnchor) {
          <site-icu-list [data]="w?.icu" [basePath]="base()" [area]="w?.query?.['area'] ?? ''" [formOnPage]="icuFormOnPage()" />
        }
      }
    }

    @if (str(p.body)) {
      <div class="wrap blk sp-compact" [class.legal-body]="legal()">
        @if (legal() && lastReviewed()) {
          <p class="last-reviewed">{{ state.t('lastReviewed', lastReviewed()) }}</p>
        }
        <div class="prose" [innerHTML]="p.body"></div>
      </div>
    }

    <!-- GEO direct answer + key facts: in the HTML for search and AI engines,
         collapsed below the fold for people. Content is server-rendered. -->
    @if (geoAnswer() || keyFacts().length) {
      <section class="wrap geo-note" aria-label="direct-answer" data-geo="answer">
        <details>
          <summary>{{ str(geoAnswer()?.['question']) || state.t('aboutOrg', orgName()) }}</summary>
          @if (geoAnswer(); as a) {
            <p class="da-a">{{ a['answer'] }}</p>
          }
          @if (keyFacts().length) {
            <dl class="key-facts" [attr.aria-label]="state.t('keyFacts')">
              @for (f of keyFacts(); track $index) {
                <div>
                  <dt>{{ f['label'] }}</dt>
                  <dd>
                    @if (str(f['source_url'])) {
                      <a [attr.href]="f['source_url']" target="_blank" rel="noopener">{{ f['value'] }}</a>
                    } @else {
                      {{ f['value'] }}
                    }
                  </dd>
                </div>
              }
            </dl>
          }
        </details>
      </section>
    }

    @if (autoFaqs().length) {
      <section class="blk wrap" aria-labelledby="faq-auto">
        <h2 id="faq-auto" class="blk-title">{{ state.t('faqTitle') }}</h2>
        <site-faq-list [items]="autoFaqs()" />
      </section>
    }

    @if (related().length) {
      <section class="blk wrap sp-compact" aria-labelledby="related-h">
        <h2 id="related-h" class="h-sm">{{ state.t('related') }}</h2>
        <ul>
          @for (r of related(); track $index) {
            <li><a [attr.href]="href(r)">{{ r['title'] || r['name'] }}</a></li>
          }
        </ul>
      </section>
    }

    <site-sources [items]="arr(p.sources)" />

    @if (bottomCtas().length && !legal()) {
      <div class="wrap"><div class="cta-row">
        @for (c of bottomCtas(); track $index) {
          <site-cta [cta]="c" [placement]="c.placement || 'bottom'" size="lg" />
        }
      </div></div>
    }

    <!-- "By … · Published · Updated": guides only (show_byline). -->
    <ng-template #byline>
      @if (showByline()) {
        <p class="page-meta">
          @if (author(); as au) {
            <span>{{ state.t('by') }} <a [attr.href]="href(au)" rel="author">{{ au['name'] }}</a>@if (str(au['job_title'], au['credentials'])) {<span>, {{ str(au['credentials'], au['job_title']) }}</span>}</span>
          }
          @if (str(p.dates?.['display_published']) && author()) {
            <span>{{ p.dates?.['display_published'] }}</span>
          }
          @if (updatedText()) {
            <time [attr.datetime]="p.dates?.['modified_at'] || null">{{ updatedText() }}</time>
          }
          @if (p['reading_time_minutes']) {
            <span>{{ p['reading_time_minutes'] }} {{ state.t('minRead') }}</span>
          }
        </p>
      }
    </ng-template>
  `
})
export class CmsPageComponent {
  readonly page = input.required<PagePayload>();
  readonly widgets = input<PageWidgets | null | undefined>(null);
  protected state = inject(SiteStateService);
  protected str = str;
  protected arr = arr;
  protected href = hrefOf;
  protected readonly icuAnchor = WIDGET_ANCHORS.icu;

  protected sections = computed(() => {
    const all = arr<PageSection>(this.page().sections).filter(s => s && s.type);
    const geo = this.page().geo?.['direct_answer'];
    const answer = str(geo?.answer);
    if (!answer) return all;
    // The page prints `geo.direct_answer` itself; a direct_answer block with
    // the same text would show it twice. Only the matching block is dropped.
    return all.filter(s => !(s.type === 'direct_answer' && str(s.data?.['answer']) === answer));
  });
  /** Same plan the resolver used to fetch the widgets' data. */
  protected plan = computed(() => widgetPlan(this.page(), this.state.site(), this.state.locale()));
  protected base = computed(() => pagePath(this.state.locale(), this.page().path));
  protected orgName = computed(() => str(this.state.site()?.organization?.name) || 'HAYAI');

  protected icuFresh = computed(() => !!this.widgets()?.icu?.meta?.['has_fresh']);
  protected hospitalRows = computed(() => (this.widgets()?.hospitals?.items.length ?? 0) > 0 || this.filtered(['area', 'insurer', 'service', 'icu_only']));
  protected articleRows = computed(() => (this.widgets()?.articles?.items.length ?? 0) > 0);
  protected guidesFiltered = computed(() => this.filtered(['q', 'category']));
  /** The ICU request form is a block on this page. */
  protected icuFormOnPage = computed(() =>
    this.sections().some(s => s.type === 'contact_form' && s.data?.['form']?.key === 'icu-bed-request')
  );

  protected h1Text = computed(() => str(this.page().h1?.text, this.page().title));
  /** The hero that carries the H1: the one `h1.section_id` names, else a hero
   *  with `is_h1`. Any other hero renders its headline as `<h2>`. */
  protected h1Section = computed<PageSection | null>(() => {
    const p = this.page();
    const heroes = this.sections().filter(s => s.type === 'hero');
    if (p.h1?.source === 'hero' && p.h1.section_id) {
      const byId = heroes.find(s => s.id === p.h1!.section_id);
      if (byId) return byId;
    }
    return heroes.find(s => s.data?.['is_h1'] === true) ?? null;
  });
  protected hasBreadcrumbBlock = computed(() => this.sections().some(s => s.type === 'breadcrumbs'));
  protected geoAnswer = computed<Dict | null>(() => {
    const a = this.page().geo?.['direct_answer'];
    return a && str(a.answer) ? a : null;
  });
  protected keyFacts = computed(() => arr<Dict>(this.page().geo?.['key_facts']).filter(f => f?.['label'] && f?.['value']));
  protected author = computed<Dict | null>(() => (this.page()['author']?.name ? this.page()['author'] : null));
  /** `show_byline` from the API; before it existed, articles only. */
  protected showByline = computed(() => {
    const v = this.page()['show_byline'];
    return typeof v === 'boolean' ? v : this.page().type === 'article';
  });
  /** A plain text page (legal, disclaimer): no blocks, only a body. */
  protected legal = computed(() => !this.sections().length && !!str(this.page().body) && this.page().type !== 'article');
  protected lastReviewed = computed(() => {
    // "Last reviewed {date}": the verification date, else the last edit.
    // (`display_modified` is a whole phrase, "Updated …", so not reused here.)
    const d = this.page().dates;
    for (const iso of [str(d?.['last_verified_at']), str(d?.['modified_at'])]) {
      const dt = iso ? new Date(iso) : null;
      if (dt && !isNaN(dt.getTime())) {
        return dt.toLocaleDateString(this.state.locale() === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
    return '';
  });
  protected featured = computed(() => img(this.page(), 'featured_image'));
  protected updatedText = computed(() => {
    const d = this.page().dates;
    if (str(d?.['display_modified'])) return d!['display_modified'];
    const iso = str(d?.['modified_at']);
    return iso ? `${this.state.t('updated')} ${iso.slice(0, 10)}` : '';
  });
  /** Attached FAQs with no FAQ block get a section at the end (contract §10). */
  protected autoFaqs = computed(() =>
    this.sections().some(s => s.type === 'faq') ? [] : arr<Dict>(this.page()['faqs'])
  );
  protected related = computed(() => arr<Dict>(this.page()['related'], this.page()['children']));
  protected bottomCtas = computed(() => {
    const c = this.page().ctas;
    return [...ctasFor(c, 'bottom'), ...ctasFor(c, 'inline'), ...ctasFor(c, 'article')];
  });

  private filtered(keys: string[]): boolean {
    const q = this.widgets()?.query ?? {};
    return keys.some(k => !!q[k]);
  }
}
