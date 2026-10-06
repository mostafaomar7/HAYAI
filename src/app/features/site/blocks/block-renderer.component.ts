import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Dict, PageSection, SiteImage } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteCtaService } from '../services/site-cta.service';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { FaqListComponent } from '../ui/faq-list.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { BuyBoxComponent } from '../ui/buy-box.component';
import { VideoBlockComponent } from './video-block.component';
import { FormBlockComponent } from './form-block.component';
import { isExternalHref, money, str } from '../site-utils';

const KNOWN_BLOCKS = new Set([
  'hero', 'rich_text', 'direct_answer', 'feature_grid', 'feature_list', 'pricing', 'product_grid',
  'product_card', 'comparison_table', 'table', 'faq', 'cta', 'contact_form', 'purchase_cta',
  'hospital_partner_cta', 'testimonial', 'statistic', 'image', 'video', 'logo_grid', 'steps',
  'benefits', 'article_list', 'doctor_list', 'hospital_list', 'custom_link', 'breadcrumbs'
]);

/**
 * Renders one page-builder section: the 27 block types of
 * `website-public-blocks.md` §6. Every field listed there is always present in
 * `data` (empty = null / [] / false), each under exactly one name, so fields
 * are read directly. Only `rich_text.html` and FAQ answers are HTML (sanitized
 * by the API); everything else is interpolated, i.e. escaped.
 *
 * Heading discipline for crawlers: only the hero flagged as the page's H1
 * source gets `<h1>`; every block title is `<h2>` and every item inside a
 * block is `<h3>`, so the outline is always h1 → h2 → h3. Tables are real
 * `<table>`s and collapsible content uses `<details>`, so all text is in the
 * server HTML. Unknown block types render nothing rather than failing.
 */
@Component({
  selector: 'site-block',
  imports: [
    NgTemplateOutlet,
    CtaButtonComponent,
    SiteImageComponent,
    FaqListComponent,
    BreadcrumbsComponent,
    BuyBoxComponent,
    VideoBlockComponent,
    FormBlockComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @let d = data();
    @let s = section();
    @if (visible()) {
    <section
      [attr.id]="s.anchor || null"
      [class]="classes()"
      [attr.data-block]="s.type"
      [attr.data-section]="sectionKey()"
      [attr.data-clarity-mask]="masked() || null"
      [attr.aria-labelledby]="headingId()"
    >
      <div class="wrap">
        @switch (s.type) {
          <!-- ============ hero ============ -->
          @case ('hero') {
            <div class="hero" [class.hero-center]="d['alignment'] === 'center'" [class.hero-has-media]="!!d['image']">
              <div class="hero-copy">
                @if (d['eyebrow']) {
                  <p class="eyebrow">{{ d['eyebrow'] }}</p>
                }
                @if (isH1()) {
                  <h1 [attr.id]="headingId()" class="hero-title">{{ h1Text() || d['headline'] }}</h1>
                  <!-- The page projects its GEO direct answer here, so it sits
                       immediately after the H1 as the spec requires. -->
                  <ng-content />
                } @else {
                  <h2 [attr.id]="headingId()" class="hero-title">{{ d['headline'] }}</h2>
                }
                @if (d['subheadline']) {
                  <p class="hero-sub">{{ d['subheadline'] }}</p>
                }
                @if (d['primary_cta'] || d['secondary_cta']) {
                  <div class="cta-row">
                    <site-cta [cta]="d['primary_cta']" placement="hero" size="lg" />
                    <site-cta [cta]="d['secondary_cta']" placement="hero" size="lg" />
                  </div>
                }
              </div>
              @if (d['image']) {
                <div class="hero-media">
                  <site-img [image]="d['image']" [priority]="priority()" sizes="(min-width: 960px) 50vw, 100vw" />
                </div>
              }
            </div>
          }

          <!-- ============ rich_text ============ -->
          @case ('rich_text') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="prose" [innerHTML]="d['html']"></div>
          }

          <!-- ============ direct_answer ============ -->
          @case ('direct_answer') {
            <div class="da" [attr.data-geo]="geoAnswerOnPage() ? null : 'answer'">
              <h2 [attr.id]="headingId()" class="da-q">{{ d['question'] }}</h2>
              <p class="da-a">{{ d['answer'] }}</p>
            </div>
          }

          <!-- ============ feature_grid ============ -->
          @case ('feature_grid') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (it of items(); track $index) {
                <article class="card">
                  @if (it['image']) {
                    <site-img [image]="it['image']" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
                  } @else if (glyph(it['icon'])) {
                    <span class="card-icon" aria-hidden="true">{{ glyph(it['icon']) }}</span>
                  }
                  <h3 class="card-title">{{ it['title'] }}</h3>
                  @if (it['description']) {
                    <p>{{ it['description'] }}</p>
                  }
                  <site-cta [cta]="it['link']" placement="inline" />
                </article>
              }
            </div>
          }

          <!-- ============ feature_list / benefits ============ -->
          @case ('feature_list') {
            <ng-container *ngTemplateOutlet="head" />
            <ng-container *ngTemplateOutlet="checklist" />
          }
          @case ('benefits') {
            <ng-container *ngTemplateOutlet="head" />
            <ng-container *ngTemplateOutlet="checklist" />
          }

          <!-- ============ steps ============ -->
          @case ('steps') {
            <ng-container *ngTemplateOutlet="head" />
            <ol class="steps">
              @for (it of items(); track $index) {
                <li class="step">
                  <span class="step-n" aria-hidden="true">{{ $index + 1 }}</span>
                  <div>
                    <h3 class="card-title">{{ it['title'] }}</h3>
                    @if (it['description']) {
                      <p>{{ it['description'] }}</p>
                    }
                  </div>
                </li>
              }
            </ol>
          }

          <!-- ============ pricing ============
               Product mode: live Tier[] of d.product; inline mode: the editor's
               tiers, product null. Both carry a ready-made \`display\`. -->
          @case ('pricing') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="table-scroll">
              <table class="price-table">
                <caption class="sr-only">{{ title() || d['product']?.name || state.t('comparePlans') }}</caption>
                <thead>
                  <tr>
                    <td></td>
                    @for (t of tiers(); track $index) {
                      <th scope="col" [class.is-rec]="t['is_recommended']">
                        <span class="tier-name">{{ t['name'] }}</span>
                        @if (t['is_recommended']) {
                          <span class="badge-rec">{{ state.t('recommended') }}</span>
                        }
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{{ state.t('price') }}</th>
                    @for (t of tiers(); track $index) {
                      <td class="price-cell" [class.is-rec]="t['is_recommended']">{{ t['display'] }}</td>
                    }
                  </tr>
                  @if (hasTierDescriptions()) {
                    <tr>
                      <th scope="row">{{ state.t('description') }}</th>
                      @for (t of tiers(); track $index) {
                        <td [class.is-rec]="t['is_recommended']">{{ t['description'] }}</td>
                      }
                    </tr>
                  }
                  @if (hasTierFeatures()) {
                    <tr>
                      <th scope="row">{{ state.t('features') }}</th>
                      @for (t of tiers(); track $index) {
                        <td [class.is-rec]="t['is_recommended']">
                          <ul class="check-list compact">
                            @for (f of t['features']; track $index) {
                              <li>{{ f }}</li>
                            }
                          </ul>
                        </td>
                      }
                    </tr>
                  }
                  @if (hasTierCtas()) {
                    <tr>
                      <td></td>
                      @for (t of tiers(); track $index) {
                        <td [class.is-rec]="t['is_recommended']">
                          <site-cta [cta]="t['cta']" placement="pricing" size="block" />
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (d['product']; as p) {
              <p class="blk-more">
                <a class="btn btn-outline" [attr.href]="p.path">{{ state.t('viewDetails') }}<span class="sr-only">: {{ p.name }}</span></a>
              </p>
            }
          }

          <!-- ============ product_grid ============ -->
          @case ('product_grid') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (p of d['products']; track p.id) {
                <ng-container *ngTemplateOutlet="productCard; context: { $implicit: p, showPrice: d['show_price'] }" />
              }
            </div>
          }

          <!-- ============ product_card / purchase_cta ============ -->
          @case ('product_card') {
            @if (d['layout'] === 'buy_box') {
              <ng-container *ngTemplateOutlet="buyBoxLayout" />
            } @else {
              <div [class.product-horizontal]="d['layout'] === 'horizontal'">
                <ng-container *ngTemplateOutlet="productCard; context: { $implicit: d['product'], showPrice: d['show_price'] }" />
              </div>
            }
          }
          @case ('purchase_cta') {
            @if (d['layout'] !== 'banner') {
              <ng-container *ngTemplateOutlet="buyBoxLayout" />
            } @else {
              <div class="cta-banner">
                <div>
                  <h2 [attr.id]="headingId()" class="blk-title">{{ title() || d['product'].name }}</h2>
                  @if (d['text']) {
                    <p>{{ d['text'] }}</p>
                  }
                  @if (d['show_price']) {
                    <p class="price-lg">{{ d['product'].pricing.display }}</p>
                  }
                </div>
                <div class="cta-row">
                  @if (d['cta']) {
                    <site-cta [cta]="d['cta']" placement="inline" size="lg" />
                  } @else {
                    <button type="button" class="btn btn-primary btn-lg" (click)="buy()">{{ state.t('purchase') }}</button>
                  }
                </div>
              </div>
            }
          }

          <!-- ============ comparison_table ============
               cells: true = ✓, false = ✗, null = empty, string = text. -->
          @case ('comparison_table') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="table-scroll">
              <table class="data-tbl">
                <caption>{{ d['caption'] }}</caption>
                <thead>
                  <tr>
                    <td></td>
                    @for (c of d['columns']; track c.key) {
                      <th scope="col" [class.is-rec]="c.key === d['highlight_column']">{{ c.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (r of d['rows']; track $index) {
                    <tr>
                      <th scope="row">{{ r.label }}</th>
                      @for (cell of r.cells; track $index) {
                        <td [class.is-rec]="d['columns'][$index]?.key === d['highlight_column']">
                          @if (cell === true) {
                            <span class="yes" aria-hidden="true">✓</span><span class="sr-only">{{ state.t('yes') }}</span>
                          } @else if (cell === false) {
                            <span class="no" aria-hidden="true">✗</span><span class="sr-only">{{ state.t('no') }}</span>
                          } @else if (cell === null) {
                            <span aria-hidden="true">—</span><span class="sr-only">{{ state.t('notIncluded') }}</span>
                          } @else {
                            {{ cell }}
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- ============ table ============ -->
          @case ('table') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="table-scroll">
              <table class="data-tbl">
                <caption>{{ d['caption'] }}</caption>
                @if (d['headers'].length) {
                  <thead>
                    <tr>
                      @for (h of d['headers']; track $index) {
                        <th scope="col">{{ h }}</th>
                      }
                    </tr>
                  </thead>
                }
                <tbody>
                  @for (r of d['rows']; track $index) {
                    <tr>
                      @for (cell of r; track $index) {
                        @if ($first) {
                          <th scope="row">{{ cell }}</th>
                        } @else {
                          <td>{{ cell }}</td>
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- ============ faq ============ -->
          @case ('faq') {
            <h2 [attr.id]="headingId()" class="blk-title">{{ title() || state.t('faqTitle') }}</h2>
            <site-faq-list [items]="d['items']" />
          }

          <!-- ============ cta ============ -->
          @case ('cta') {
            <div class="cta-banner" [attr.data-variant]="d['variant']">
              <div>
                @if (title()) {
                  <h2 [attr.id]="headingId()" class="blk-title">{{ title() }}</h2>
                }
                @if (d['text']) {
                  <p>{{ d['text'] }}</p>
                }
              </div>
              <div class="cta-row">
                <site-cta [cta]="d['cta']" placement="inline" size="lg" />
                <site-cta [cta]="d['secondary_cta']" placement="inline" size="lg" />
              </div>
            </div>
          }

          <!-- ============ contact_form ============ -->
          @case ('contact_form') {
            <div class="form-card">
              <h2 [attr.id]="headingId()" class="blk-title">{{ title() || d['form'].name }}</h2>
              @if (intro()) {
                <p class="muted">{{ intro() }}</p>
              }
              <site-form-block [form]="d['form']" />
            </div>
          }

          <!-- ============ hospital_partner_cta ============ -->
          @case ('hospital_partner_cta') {
            <div class="partner">
              <div class="partner-copy">
                <h2 [attr.id]="headingId()" class="blk-title">{{ d['heading'] }}</h2>
                @if (d['text']) {
                  <p>{{ d['text'] }}</p>
                }
                @if (d['benefits'].length) {
                  <ul class="check-list">
                    @for (b of d['benefits']; track $index) {
                      <li>{{ b }}</li>
                    }
                  </ul>
                }
                @if (d['image']) {
                  <site-img [image]="d['image']" sizes="(min-width: 960px) 40vw, 100vw" cls="partner-img" />
                }
                <site-cta [cta]="d['cta']" placement="inline" />
              </div>
              <!-- \`form\` is null when that form is inactive: the pitch and CTA still show. -->
              @if (d['form']) {
                <div class="form-card">
                  <site-form-block [form]="d['form']" [showTitle]="true" />
                </div>
              }
            </div>
          }

          <!-- ============ testimonial ============ -->
          @case ('testimonial') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (it of items(); track $index) {
                <figure class="card quote">
                  <blockquote>“{{ it['quote'] }}”</blockquote>
                  <figcaption>
                    @if (it['image']) {
                      <site-img [image]="it['image']" sizes="48px" cls="avatar" />
                    }
                    <span>
                      <strong>{{ it['author_name'] }}</strong>
                      @if (it['author_title'] || it['organization']) {
                        <span class="muted">{{ joinParts(it['author_title'], it['organization']) }}</span>
                      }
                    </span>
                  </figcaption>
                </figure>
              }
            </div>
          }

          <!-- ============ statistic ============ -->
          @case ('statistic') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid stats" [style.--cols]="cols(4)">
              @for (it of items(); track $index) {
                <div class="stat">
                  <p class="stat-value">{{ it['value'] }}</p>
                  <h3 class="stat-label">{{ it['label'] }}</h3>
                  @if (it['description']) {
                    <p class="muted">{{ it['description'] }}</p>
                  }
                  @if (it['source_url']) {
                    <a class="stat-src" [attr.href]="it['source_url']" [attr.target]="external(it['source_url']) ? '_blank' : null"
                       [attr.rel]="external(it['source_url']) ? 'noopener noreferrer' : null">{{ state.t('sources') }}</a>
                  }
                </div>
              }
            </div>
          }

          <!-- ============ image ============ -->
          @case ('image') {
            <figure class="figure" [attr.data-size]="d['size']">
              @if (d['link_url']) {
                <a [attr.href]="d['link_url']">
                  <site-img [image]="d['image']" [priority]="priority()" sizes="(min-width: 1200px) 1100px, 100vw" />
                </a>
              } @else {
                <site-img [image]="d['image']" [priority]="priority()" sizes="(min-width: 1200px) 1100px, 100vw" />
              }
              @if (d['caption'] || d['image'].caption) {
                <figcaption>{{ d['caption'] || d['image'].caption }}</figcaption>
              }
            </figure>
          }

          <!-- ============ video ============ -->
          @case ('video') {
            <site-video-block [data]="d" />
          }

          <!-- ============ logo_grid ============ -->
          @case ('logo_grid') {
            <ng-container *ngTemplateOutlet="head" />
            <ul class="logos">
              @for (it of items(); track $index) {
                <li>
                  @if (it['url']) {
                    <a [attr.href]="it['url']" [attr.target]="external(it['url']) ? '_blank' : null"
                       [attr.rel]="external(it['url']) ? 'noopener noreferrer' : null" [attr.title]="it['name']">
                      <site-img [image]="it['image']" [altText]="it['name']" sizes="160px" cls="logo-img" />
                    </a>
                  } @else {
                    <site-img [image]="it['image']" [altText]="it['name']" sizes="160px" cls="logo-img" />
                  }
                </li>
              }
            </ul>
          }

          <!-- ============ article_list ============ -->
          @case ('article_list') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (a of d['articles']; track a.id) {
                <article class="card article-card">
                  @if (a.image) {
                    <site-img [image]="a.image" [altText]="a.title" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
                  }
                  <h3 class="card-title"><a [attr.href]="a.path">{{ a.title }}</a></h3>
                  @if (a.excerpt) {
                    <p>{{ a.excerpt }}</p>
                  }
                  <p class="meta">
                    @if (a.author?.name) {
                      <span>{{ a.author.name }}</span>
                    }
                    <time [attr.datetime]="a.published_at">{{ date(a.published_at) }}</time>
                    @if (a.reading_time_minutes) {
                      <span>{{ a.reading_time_minutes }} {{ state.t('minRead') }}</span>
                    }
                  </p>
                </article>
              }
            </div>
          }

          <!-- ============ doctor_list / hospital_list ============
               Doctor.image / Hospital.logo are plain URLs, not Image objects. -->
          @case ('doctor_list') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (x of d['doctors']; track x.id) {
                <article class="card">
                  @if (x.image) {
                    <site-img [image]="urlImage(x.image, x.name)" sizes="96px" cls="avatar-lg" />
                  }
                  <h3 class="card-title"><a [attr.href]="x.path">{{ x.name }}</a></h3>
                  @if (x.specialty?.name || x.job_title) {
                    <p>{{ joinParts(x.job_title, x.specialty?.name) }}</p>
                  }
                  @if (x.location) {
                    <p class="muted">{{ x.location }}</p>
                  }
                </article>
              }
            </div>
          }
          @case ('hospital_list') {
            <ng-container *ngTemplateOutlet="head" />
            <div class="grid" [style.--cols]="cols()">
              @for (x of d['hospitals']; track x.id) {
                <article class="card">
                  @if (x.logo) {
                    <site-img [image]="urlImage(x.logo, x.name)" sizes="96px" cls="avatar-lg" />
                  }
                  <h3 class="card-title"><a [attr.href]="x.path">{{ x.name }}</a></h3>
                  @if (x.address || x.location) {
                    <p class="muted">{{ x.address || x.location }}</p>
                  }
                  @if (x.specialties.length) {
                    <p>{{ x.specialties.join(', ') }}</p>
                  }
                </article>
              }
            </div>
          }

          <!-- ============ custom_link ============ -->
          @case ('custom_link') {
            <a class="link-card" [attr.href]="d['url']" [attr.target]="d['target'] === '_blank' ? '_blank' : null" [attr.rel]="d['rel']">
              <span class="link-card-label">{{ d['label'] }}</span>
              @if (d['description']) {
                <span class="muted">{{ d['description'] }}</span>
              }
            </a>
          }

          <!-- ============ breadcrumbs ============ -->
          @case ('breadcrumbs') {
            <site-breadcrumbs [items]="d['items']" />
          }
        }
      </div>
    </section>
    }

    <!-- Shared fragments ------------------------------------------------- -->
    <ng-template #head>
      @if (title()) {
        <h2 [attr.id]="headingId()" class="blk-title">{{ title() }}</h2>
      }
      @if (intro()) {
        <p class="blk-intro">{{ intro() }}</p>
      }
    </ng-template>

    <ng-template #checklist>
      <ul class="check-list">
        @for (it of items(); track $index) {
          <li>
            <h3 class="li-title">{{ it['title'] }}</h3>
            @if (it['description']) {
              <p>{{ it['description'] }}</p>
            }
          </li>
        }
      </ul>
    </ng-template>

    <!-- ProductSummary (§5.3) -->
    <ng-template #productCard let-p let-showPrice="showPrice">
      <article class="card product-card">
        @if (p.image) {
          <site-img [image]="p.image" [altText]="p.name" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
        }
        <h3 class="card-title"><a [attr.href]="p.path">{{ p.name }}</a></h3>
        @if (p.short_description) {
          <p>{{ p.short_description }}</p>
        }
        @if (showPrice) {
          <p class="price-sm">
            {{ p.pricing.display }}
            @if (p.pricing.compare_at_price) {
              <s class="muted">{{ compareAt(p.pricing) }}</s>
            }
          </p>
        }
        <p class="avail" [attr.data-status]="p.availability.status">{{ p.availability.label }}</p>
        <a class="btn btn-outline btn-sm" [attr.href]="p.path">{{ state.t('viewDetails') }}<span class="sr-only">: {{ p.name }}</span></a>
      </article>
    </ng-template>

    <!-- product_card (layout buy_box) and purchase_cta (layout buy_box / null) -->
    <ng-template #buyBoxLayout>
      @let p = buyProduct()!;
      <div class="pdp pdp-inline">
        <div class="pdp-media">
          @if (p['image']) {
            <site-img [image]="p['image']" sizes="(min-width: 960px) 45vw, 100vw" />
          }
        </div>
        <div class="pdp-info">
          <h2 [attr.id]="headingId()" class="blk-title">
            <a [attr.href]="p['path']">{{ title() || p['name'] }}</a>
          </h2>
          @if (blockText() || p['short_description']) {
            <p>{{ blockText() || p['short_description'] }}</p>
          }
        </div>
        <aside class="pdp-buy">
          <site-buy-box
            [product]="p"
            [purchaseInfo]="purchaseInfo()"
            [ctas]="data()['ctas']['sidebar'] ?? []"
            [showPrice]="data()['show_price']"
            [primaryCta]="data()['cta'] ?? null"
          />
        </aside>
      </div>
    </ng-template>
  `
})
export class BlockRendererComponent {
  readonly section = input.required<PageSection>();
  /** This hero is the page's H1 source. */
  readonly isH1 = input(false);
  readonly h1Text = input<string | null>(null);
  /** First visual block: its image is the LCP candidate. */
  readonly priority = input(false);
  /** The page already printed its GEO direct answer after the H1. */
  readonly geoAnswerOnPage = input(false);

  protected state = inject(SiteStateService);
  private ctaService = inject(SiteCtaService);

  protected data = computed<Dict>(() => this.section().data);
  /**
   * Known type with something to show. A type added to the CMS later renders
   * nothing until the site learns it; the doctor / hospital directories are
   * `available: false` with an empty list while they are private.
   */
  protected visible = computed(() => {
    const { type } = this.section();
    if (!KNOWN_BLOCKS.has(type)) return false;
    const d = this.data();
    if (type === 'doctor_list') return d['available'] && d['doctors'].length > 0;
    if (type === 'hospital_list') return d['available'] && d['hospitals'].length > 0;
    if (type === 'pricing') return d['tiers'].length > 0;
    return true;
  });
  protected title = computed<string | null>(() => this.data()['heading'] ?? null);
  protected intro = computed<string | null>(() => this.data()['intro'] ?? null);
  protected blockText = computed<string | null>(() => this.data()['text'] ?? null);
  protected items = computed<Dict[]>(() => this.data()['items'] ?? []);
  protected headingId = computed(() => {
    const s = this.section();
    if (['video', 'breadcrumbs', 'custom_link', 'image'].includes(s.type)) return null;
    const own = ['hero', 'direct_answer', 'faq', 'contact_form', 'hospital_partner_cta', 'product_card', 'purchase_cta'];
    const hasHeading = own.includes(s.type) || !!this.title();
    return hasHeading ? `h-${s.anchor || s.id || s.type}` : null;
  });

  /**
   * What the visibility trigger reports as a viewed section.
   *
   * An anchor means the editor named this block, which is the only signal
   * we have that it matters; the rest are the blocks a visitor's attention
   * is worth knowing about on any page. Tagging every block instead would
   * put a dozen section views on every page view and tell nobody anything.
   */
  protected sectionKey = computed(() => {
    const s = this.section();
    const KEY = ['pricing', 'faq', 'contact_form', 'purchase_cta', 'hospital_partner_cta', 'comparison_table', 'steps'];
    return str(s.anchor) || (KEY.includes(s.type) ? s.type : null);
  });

  /**
   * Clarity records sessions. A block where a patient types their name,
   * phone or anything about their health is masked at the container, so no
   * recording can contain it even if a field is added later.
   */
  protected masked = computed(() => {
    const MASK = ['contact_form', 'purchase_cta', 'hospital_partner_cta'];
    return MASK.includes(this.section().type) ? 'true' : null;
  });

  protected classes = computed(() => {
    const s = this.section();
    const out = ['blk', `blk-${s.type.replace(/_/g, '-')}`];
    if (s.settings) {
      for (const where of s.settings.hide_on) out.push(`hide-${where}`);
      if (s.settings.theme && s.settings.theme !== 'default') out.push(`theme-${s.settings.theme}`);
      if (s.settings.spacing && s.settings.spacing !== 'normal') out.push(`sp-${s.settings.spacing}`);
    }
    return out.join(' ');
  });

  protected tiers = computed<Dict[]>(() => this.data()['tiers'] ?? []);
  protected hasTierDescriptions = computed(() => this.tiers().some(t => t['description']));
  protected hasTierFeatures = computed(() => this.tiers().some(t => t['features'].length));
  /** Only inline tiers have a `cta`. */
  protected hasTierCtas = computed(() => this.tiers().some(t => t['cta']));

  /**
   * product_card / purchase_cta: the ProductSummary with the block's live
   * `tiers` attached, so the buy box and the purchase dialog offer the plans.
   */
  protected buyProduct = computed<Dict | null>(() => {
    const d = this.data();
    return d['product'] ? { ...d['product'], tiers: d['tiers'] } : null;
  });
  /** PurchaseBox; when disabled the buy box falls back to `purchase-inquiry`. */
  protected purchaseInfo = computed<Dict | null>(() => {
    const p = this.data()['purchase'];
    return p?.enabled ? p : null;
  });

  protected cols(fallback = 3): number {
    const n = Number(this.data()['columns']);
    return n >= 2 && n <= 4 ? n : Math.min(fallback, Math.max(1, this.items().length || fallback));
  }

  /** `icon` is an icon *name* ("shield", "bed"); names are not printed as
   *  words, only an emoji / symbol an editor typed shows. */
  protected glyph(icon: string | null): string {
    return icon && !/^[a-z0-9_-]+$/i.test(icon) ? icon : '';
  }

  protected external(href: string): boolean {
    return /^(https?:)?\/\//i.test(href) && isExternalHref(href);
  }

  /** `compare_at_price` comes as a raw decimal string, with no `display`. */
  protected compareAt(pricing: Dict): string {
    return money(pricing['compare_at_price'], pricing['currency'], this.state.locale());
  }

  protected date(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(this.state.locale() === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  protected urlImage(url: string, alt: string): SiteImage {
    return { url, alt, width: 96, height: 96 };
  }

  protected joinParts(...parts: (string | null | undefined)[]): string {
    return parts.filter(Boolean).join(', ');
  }

  protected buy(): void {
    const p = this.buyProduct();
    const info = this.purchaseInfo();
    if (!p) return;
    if (info) this.ctaService.openPurchase(p, info, null, null, null);
    else this.ctaService.openForm(this.data()['purchase']?.fallback_form_key ?? 'purchase-inquiry');
  }
}
