import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Dict, PageSection, SiteImage } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { BuyBoxComponent } from '../ui/buy-box.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { FaqListComponent } from '../ui/faq-list.component';
import { SourcesListComponent } from '../ui/sources-list.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { BlockRendererComponent } from '../blocks/block-renderer.component';
import { arr, ctasFor, hrefOf, img, priceText, str } from '../site-utils';

/**
 * Product / service page, laid out like an Amazon product page: gallery on
 * the start side, details in the middle, and a sticky buy box on the end side
 * (sides swap automatically in Arabic). Name (H1), direct answer, price,
 * availability, features, specifications and description are all plain HTML
 * in the server response — the `curl | grep <price>` acceptance check.
 */
@Component({
  selector: 'site-product-page',
  imports: [
    BuyBoxComponent,
    BreadcrumbsComponent,
    FaqListComponent,
    SourcesListComponent,
    SiteImageComponent,
    CtaButtonComponent,
    BlockRendererComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = product();
    @if (p['is_preview']) {
      <p class="preview-banner" role="note">{{ state.t('previewBanner') }}</p>
    }
    <site-breadcrumbs [items]="arr(p['breadcrumbs'])" />

    <div class="wrap pdp">
      <div class="pdp-media">
        @if (images().length) {
          <div class="gallery-main">
            <site-img [image]="images()[active()]" [priority]="active() === 0" sizes="(min-width: 1100px) 40vw, (min-width: 768px) 50vw, 100vw" />
          </div>
          @if (images().length > 1) {
            <ul class="gallery-thumbs" [attr.aria-label]="state.t('gallery')">
              @for (im of images(); track $index) {
                <li>
                  <button
                    type="button"
                    [attr.aria-current]="active() === $index ? 'true' : null"
                    [attr.aria-label]="state.t('viewImage') + ' ' + ($index + 1)"
                    (click)="active.set($index)"
                  >
                    <site-img [image]="im" sizes="64px" />
                  </button>
                </li>
              }
            </ul>
          }
        }
      </div>

      <div class="pdp-info">
        @if (str(p['category']?.name)) {
          <p class="eyebrow">
            @if (hrefOf(p['category']) !== '#') {
              <a [attr.href]="hrefOf(p['category'])">{{ p['category'].name }}</a>
            } @else {
              {{ p['category'].name }}
            }
          </p>
        }
        <h1>{{ str(p['h1']?.text, p['name'], p['title']) }}</h1>
        @if (geoAnswer(); as a) {
          <section class="da" aria-label="direct-answer" data-geo="answer">
            @if (str(a['question'])) {
              <h2 class="da-q">{{ a['question'] }}</h2>
            }
            <p class="da-a">{{ a['answer'] }}</p>
          </section>
        }
        @if (str(p['short_description'])) {
          <p class="lead">{{ p['short_description'] }}</p>
        }
        @if (price()) {
          <p class="price-lg"><span class="sr-only">{{ state.t('price') }}: </span>{{ price() }}</p>
        }
        @if (str(p['availability']?.label)) {
          <p class="avail" [attr.data-status]="p['availability']?.status">{{ p['availability']?.label }}</p>
        }
        @if (features().length) {
          <ul class="check-list compact">
            @for (f of features().slice(0, 6); track $index) {
              <li>{{ f['title'] }}</li>
            }
          </ul>
        }
        @if (updatedText()) {
          <p class="page-meta"><time [attr.datetime]="p['dates']?.modified_at || null">{{ updatedText() }}</time></p>
        }
      </div>

      <aside class="pdp-buy" [attr.aria-label]="state.t('purchase')">
        <site-buy-box
          [product]="p"
          [purchaseInfo]="p['purchase'] ?? null"
          [ctas]="sidebarCtas()"
          [primaryCta]="purchaseCta()"
        />
      </aside>
    </div>

    @if (str(p['description'])) {
      <section class="blk wrap sp-compact" aria-labelledby="pd-desc">
        <h2 id="pd-desc" class="blk-title">{{ state.t('description') }}</h2>
        <div class="prose" [innerHTML]="p['description']"></div>
      </section>
    }

    @if (features().length) {
      <section class="blk wrap sp-compact" aria-labelledby="pd-feat">
        <h2 id="pd-feat" class="blk-title">{{ state.t('features') }}</h2>
        <ul class="check-list">
          @for (f of features(); track $index) {
            <li>
              <h3 class="li-title">{{ f['title'] }}</h3>
              @if (str(f['description'])) {
                <p>{{ f['description'] }}</p>
              }
            </li>
          }
        </ul>
      </section>
    }

    @if (specs().length) {
      <section class="blk wrap sp-compact" aria-labelledby="pd-spec">
        <h2 id="pd-spec" class="blk-title">{{ state.t('specifications') }}</h2>
        <div class="table-scroll spec-table">
          <table class="data-tbl">
            <caption class="sr-only">{{ state.t('specifications') }}</caption>
            <tbody>
              @for (s of specs(); track $index) {
                <tr><th scope="row">{{ s['label'] }}</th><td>{{ s['value'] }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @if (tiers().length > 1) {
      <section class="blk wrap sp-compact" aria-labelledby="pd-plans">
        <h2 id="pd-plans" class="blk-title">{{ state.t('plans') }}</h2>
        <div class="table-scroll">
          <table class="data-tbl">
            <caption class="sr-only">{{ state.t('comparePlans') }}</caption>
            <thead><tr><th scope="col">{{ state.t('plan') }}</th><th scope="col">{{ state.t('price') }}</th><th scope="col">{{ state.t('features') }}</th></tr></thead>
            <tbody>
              @for (t of tiers(); track $index) {
                <tr>
                  <th scope="row">{{ t['name'] }}</th>
                  <td>{{ tierPrice(t) || state.t('priceOnRequest') }}</td>
                  <td>{{ tierFeatures(t).join(' · ') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }

    @for (s of sections(); track s.id ?? $index) {
      <site-block [section]="s" />
    }

    @if (faqs().length) {
      <section class="blk wrap" aria-labelledby="pd-faq">
        <h2 id="pd-faq" class="blk-title">{{ state.t('faqTitle') }}</h2>
        <site-faq-list [items]="faqs()" />
      </section>
    }

    <site-sources [items]="arr(p['sources'])" />

    @if (bottomCtas().length) {
      <div class="wrap"><div class="cta-row">
        @for (c of bottomCtas(); track $index) {
          <site-cta [cta]="c" placement="bottom" size="lg" />
        }
      </div></div>
    }
  `
})
export class ProductPageComponent {
  readonly product = input.required<Dict>();
  protected state = inject(SiteStateService);
  protected str = str;
  protected arr = arr;
  protected hrefOf = hrefOf;
  protected active = signal(0);

  protected images = computed<SiteImage[]>(() => {
    const p = this.product();
    const all = [img(p, 'featured_image', 'image'), ...arr<any>(p['gallery']).map(g => img({ g }, 'g'))].filter(
      (x): x is SiteImage => !!x
    );
    const seen = new Set<string>();
    return all.filter(x => (seen.has(x.url) ? false : (seen.add(x.url), true)));
  });
  protected price = computed(() => priceText(this.product()));
  protected geoAnswer = computed<Dict | null>(() => {
    const a = this.product()['geo']?.direct_answer;
    return a && str(a.answer) ? a : null;
  });
  protected features = computed(() =>
    arr<any>(this.product()['features'])
      .map(f => (typeof f === 'string' ? { title: f } : f))
      .filter(f => str(f?.title))
  );
  protected specs = computed(() => arr<Dict>(this.product()['specifications']).filter(s => str(s?.['label'])));
  protected tiers = computed(() => arr<Dict>(this.product()['tiers']));
  protected faqs = computed(() => arr<Dict>(this.product()['faqs']));
  protected sections = computed(() => arr<PageSection>(this.product()['sections']).filter(s => s?.type));
  protected sidebarCtas = computed(() => ctasFor(this.product()['ctas'], 'sidebar'));
  protected purchaseCta = computed(() => this.sidebarCtas().find(c => c?.action?.kind === 'purchase') ?? null);
  protected bottomCtas = computed(() => [...ctasFor(this.product()['ctas'], 'bottom'), ...ctasFor(this.product()['ctas'], 'inline')]);
  protected updatedText = computed(() => {
    const d = this.product()['dates'];
    return str(d?.display_modified) || (str(d?.modified_at) ? `${this.state.t('updated')} ${str(d?.modified_at).slice(0, 10)}` : '');
  });

  protected tierPrice(t: Dict): string {
    return priceText(t);
  }

  protected tierFeatures(t: Dict): string[] {
    return arr<any>(t['features']).map(f => (typeof f === 'string' ? f : str(f?.title))).filter(Boolean);
  }
}
