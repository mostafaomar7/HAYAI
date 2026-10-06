import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Dict, PagePayload, PageSection } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { BlockRendererComponent } from '../blocks/block-renderer.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { FaqListComponent } from '../ui/faq-list.component';
import { SourcesListComponent } from '../ui/sources-list.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { arr, ctasFor, hrefOf, img, str } from '../site-utils';

/**
 * A CMS page (home, landing, article…) — payload §18.2.
 *
 * Crawler contract implemented here:
 *  - exactly one `<h1>`: the hero flagged as the H1 source, otherwise
 *    `h1.text` printed as the page title;
 *  - the GEO direct answer immediately after that H1, in
 *    `<section aria-label="direct-answer" data-geo="answer">`;
 *  - the visible "Updated …" date (`dates.display_modified`);
 *  - FAQ / sources / CTAs in the HTML, never fetched later.
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
    CtaButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = page();
    @if (p.is_preview) {
      <p class="preview-banner" role="note">{{ state.t('previewBanner') }}</p>
    }
    @if (!hasBreadcrumbBlock()) {
      <site-breadcrumbs [items]="p.breadcrumbs ?? []" />
    }

    @if (!h1Section()) {
      <header class="page-head wrap">
        <h1>{{ h1Text() }}</h1>
        <ng-container *ngTemplateOutlet="answerBox" />
        @if (str(p.subtitle)) {
          <p class="lead">{{ p.subtitle }}</p>
        }
        <ng-container *ngTemplateOutlet="answerMeta" />
        @if (featured()) {
          <div class="featured-img">
            <site-img [image]="featured()" [priority]="true" sizes="(min-width: 1200px) 1160px, 100vw" />
          </div>
        }
      </header>
    }

    @for (s of sections(); track s.id ?? $index) {
      <site-block
        [section]="s"
        [isH1]="s === h1Section()"
        [h1Text]="s === h1Section() ? h1Text() : null"
        [priority]="$first"
        [geoAnswerOnPage]="!!geoAnswer()"
      >
        @if (s === h1Section()) {
          <ng-container *ngTemplateOutlet="answerBox" />
        }
      </site-block>
      @if (s === h1Section()) {
        <div class="wrap"><ng-container *ngTemplateOutlet="answerMeta" /></div>
      }
    }

    @if (str(p.body)) {
      <div class="wrap blk sp-compact">
        <div class="prose" [innerHTML]="p.body"></div>
      </div>
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

    @if (bottomCtas().length) {
      <div class="wrap"><div class="cta-row">
        @for (c of bottomCtas(); track $index) {
          <site-cta [cta]="c" [placement]="c.placement || 'bottom'" size="lg" />
        }
      </div></div>
    }

    <!-- GEO direct answer: printed immediately after the H1. -->
    <ng-template #answerBox>
      @if (geoAnswer(); as a) {
        <section class="da" aria-label="direct-answer" data-geo="answer">
          @if (str(a['question'])) {
            <h2 class="da-q">{{ a['question'] }}</h2>
          }
          <p class="da-a">{{ a['answer'] }}</p>
        </section>
      }
    </ng-template>

    <!-- Key facts + byline + visible "Updated …" date. -->
    <ng-template #answerMeta>
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
    </ng-template>
  `
})
export class CmsPageComponent {
  readonly page = input.required<PagePayload>();
  protected state = inject(SiteStateService);
  protected str = str;
  protected arr = arr;
  protected href = hrefOf;

  protected sections = computed(() => {
    const all = arr<PageSection>(this.page().sections).filter(s => s && s.type);
    const geo = this.page().geo?.['direct_answer'];
    const answer = str(geo?.answer);
    if (!answer) return all;
    // The SEO spec puts the direct answer immediately after the H1, and this
    // page prints `geo.direct_answer` there. An editor who also added a
    // direct_answer block with the same text would have it rendered twice —
    // four of the five content pages did. Only the matching block is dropped,
    // so a page that genuinely answers a second question still shows it.
    return all.filter(
      s => !(s.type === 'direct_answer' && str(s.data?.['answer']) === answer)
    );
  });
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
}
