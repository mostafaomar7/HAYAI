import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Dict, PagePayload, ResolvedView, SeoData } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SeoHeadService } from '../services/seo-head.service';
import { CmsPageComponent } from './cms-page.component';
import { ProductPageComponent } from './product-page.component';
import { AuthorPageComponent } from './author-page.component';
import { ListingPageComponent } from './listing-page.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, buildJsonLd, img, str } from '../site-utils';

/**
 * The catch-all public page: renders whatever the resolver found for the URL
 * and writes the matching `<head>` (title, description, canonical, robots,
 * hreflang, Open Graph / Twitter, JSON-LD) for that exact response.
 */
@Component({
  selector: 'site-view',
  imports: [
    NgTemplateOutlet,
    CmsPageComponent,
    ProductPageComponent,
    AuthorPageComponent,
    ListingPageComponent,
    BreadcrumbsComponent,
    SiteImageComponent
  ],
  styleUrl: './site-view.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // What the page is, for the server's tracking metadata (server.ts reads it
  // out of the render to decide whether session recording may load).
  host: {
    '[attr.data-page-kind]': 'view()?.result?.kind ?? null',
    '[attr.data-page-type]': 'pageType()'
  },
  template: `
    @if (view(); as v) {
      @switch (v.result.kind) {
        @case ('page') {
          <site-cms-page [page]="v.result.data" />
        }
        @case ('product') {
          <site-product-page [product]="v.result.data" />
        }
        @case ('author') {
          <site-author-page [author]="v.result.data" />
        }
        @case ('listing') {
          <site-listing-page [view]="v" />
        }
        @case ('doctor') {
          <ng-container [ngTemplateOutlet]="entity" />
        }
        @case ('hospital') {
          <ng-container [ngTemplateOutlet]="entity" />
        }
        @case ('redirect') {
          <div class="wrap center-page">
            <p>{{ state.t('redirecting') }}</p>
            @if (redirectTo()) {
              <a [attr.href]="redirectTo()">{{ redirectTo() }}</a>
            }
          </div>
        }
        @case ('error') {
          <div class="wrap center-page">
            <h1>{{ state.t('errorTitle') }}</h1>
            <p class="muted">{{ state.t('errorText') }}</p>
          </div>
        }
        @default {
          <div class="wrap center-page">
            <h1>{{ state.t('notFoundTitle') }}</h1>
            <p class="muted">{{ v.result.data?.preview ? state.t('previewInvalid') : state.t('notFoundText') }}</p>
            <a class="btn btn-primary" [attr.href]="'/' + v.locale">{{ state.t('backHome') }}</a>
          </div>
        }
      }

      <!-- Directory doctor / hospital (only exists when the directory is public). -->
      <ng-template #entity>
        @let e = v.result.data;
        <site-breadcrumbs [items]="arr(e?.breadcrumbs)" />
        <header class="wrap page-head">
          @if (img(e, 'photo', 'image', 'logo')) {
            <site-img [image]="img(e, 'photo', 'image', 'logo')" [priority]="true" sizes="96px" cls="avatar-lg" />
          }
          <h1>{{ str(e?.h1?.text, e?.name, e?.title) }}</h1>
          @if (str(e?.specialty?.name, e?.specialty, e?.job_title)) {
            <p class="lead">{{ str(e?.specialty?.name, e?.specialty, e?.job_title) }}</p>
          }
        </header>
        <div class="wrap">
          <dl class="key-facts">
            @for (f of entityFacts(e); track f.label) {
              <div><dt>{{ f.label }}</dt><dd>{{ f.value }}</dd></div>
            }
          </dl>
          @if (str(e?.description, e?.bio, e?.about)) {
            <div class="prose" [innerHTML]="str(e?.description, e?.bio, e?.about)"></div>
          }
        </div>
      </ng-template>
    }
  `
})
export class SiteViewComponent {
  protected state = inject(SiteStateService);
  private seo = inject(SeoHeadService);
  private route = inject(ActivatedRoute);
  protected str = str;
  protected arr = arr;
  protected img = img;

  protected view = toSignal(this.route.data.pipe(map(d => d['view'] as ResolvedView)), {
    initialValue: this.route.snapshot.data['view'] as ResolvedView
  });
  protected redirectTo = computed(() => str(this.view()?.result.redirect?.location, this.view()?.result.redirect?.url));
  protected pageType = computed(() => pageTypeOf(this.view()));

  constructor() {
    // Runs synchronously for the initial data (server render included) and on
    // every later navigation that reuses this component.
    this.route.data.subscribe(d => this.applyView(d['view'] as ResolvedView));
  }

  protected entityFacts(e: Dict | null): { label: string; value: string }[] {
    if (!e) return [];
    const keys = ['city', 'area', 'address', 'phone', 'hospital', 'years_of_experience', 'beds', 'icu_beds'];
    return keys
      .map(k => ({ label: k.replace(/_/g, ' '), value: str(e[k]?.name, e[k]) }))
      .filter(f => f.value);
  }

  private applyView(v: ResolvedView | undefined): void {
    if (!v) return;
    const { result, locale } = v;
    const site = this.state.site();
    const suffix = str(site?.organization?.name) || 'HAYAI';
    const siteSchema = site?.schema ?? null;

    const isEntity = ['page', 'product', 'author', 'doctor', 'hospital'].includes(result.kind) && result.data;
    this.state.page.set(result.kind === 'page' || result.kind === 'product' ? (result.data as PagePayload) : null);
    this.state.tagPage.set({ pageType: pageTypeOf(v), measurement: measurementOf(v) });

    if (isEntity) {
      const d = result.data as Dict;
      const seo: SeoData = d['seo'] ?? {};
      this.state.alternates.set(arr(seo.alternates));
      const firstHero = arr<Dict>(d['sections']).find(s => s?.['type'] === 'hero');
      this.seo.apply({
        locale,
        dir: d['dir'],
        title: str(seo.title, d['title'], d['name']) || suffix,
        description: str(seo.description, d['excerpt'], d['short_description'], d['geo']?.direct_answer?.answer),
        canonical: d['is_preview'] ? null : seo.canonical,
        // Previews are always noindex whatever the draft's own SEO says.
        robots: d['is_preview'] ? 'noindex, nofollow' : seo.robots,
        alternates: d['is_preview'] ? [] : seo.alternates,
        openGraph: seo.open_graph,
        twitter: seo.twitter,
        jsonLd: d['is_preview'] ? null : buildJsonLd(d['schema_script'], siteSchema),
        preloadImage: img(firstHero?.['data'], 'image') ?? img(d, 'featured_image')
      });
      return;
    }

    if (result.kind === 'listing') {
      const seo: SeoData = v.listing?.seo ?? {};
      // Two sources carry a listing's schema, and they are not equivalent.
      // The listing call knows the rows on this page, so its CollectionPage
      // holds a `mainEntity: ItemList` numbered across pages; resolve never
      // loads the rows, so its copy has the CollectionPage and breadcrumb
      // only. Prefer the listing call and keep resolve as the fallback, so a
      // listing whose items endpoint failed still ships JSON-LD.
      const listingScript = str(v.listing?.meta?.['schema_script'])
        || str((result.data as Dict | null)?.['schema_script']);
      this.state.alternates.set(arr(seo.alternates));
      this.seo.apply({
        locale,
        title: str(seo.title) || suffix,
        description: seo.description,
        canonical: seo.canonical,
        robots: seo.robots ?? (v.listing?.kind === 'search' ? 'noindex, follow' : null),
        alternates: seo.alternates,
        openGraph: seo.open_graph,
        twitter: seo.twitter,
        jsonLd: buildJsonLd(listingScript, siteSchema)
      });
      return;
    }

    // not_found / error / redirect: never indexable, no canonical/alternates.
    this.state.alternates.set([]);
    const title =
      result.kind === 'error' ? this.state.t('errorTitle') : result.kind === 'redirect' ? this.state.t('redirecting') : this.state.t('notFoundTitle');
    this.seo.apply({ locale, title: `${title} | ${suffix}`, robots: 'noindex, follow' });
  }
}

/**
 * The template the page was rendered from, for the tag manager (`page_type`).
 *
 * Derived from what the resolver returned, never from the URL, for the same
 * reason `page_sensitivity` is: a renamed slug must not change what the page
 * reports itself as. The server reads it back off this component's host
 * attribute for the first render; TagLayerService reads it on in-app moves.
 */
export function pageTypeOf(v: ResolvedView | undefined | null): string {
  if (!v) return 'unknown';
  const { result } = v;
  switch (result.kind) {
    case 'page':
      // The CMS template: home / page / landing / article.
      return str(result.data?.type) || 'page';
    case 'product':
      return 'product';
    case 'author':
      return 'author';
    case 'doctor':
      return 'doctor_profile';
    case 'hospital':
      return 'hospital_profile';
    case 'listing': {
      const kind = v.listing?.kind === 'blog' ? 'articles' : str(v.listing?.kind);
      if (kind === 'search') return 'search_results';
      return kind ? `${kind}_listing` : 'listing';
    }
    case 'not_found':
      return 'not_found';
    default:
      return result.kind;
  }
}

/** The API's classification of the page, wherever this kind of result keeps it. */
export function measurementOf(v: ResolvedView | undefined | null): Dict | null {
  if (!v) return null;
  // A 404 carries no payload; these are the contract's fixed values, the same
  // ones the server renders.
  if (v.result.kind === 'not_found') return { page_sensitivity: 'standard', content_group: 'other', journey_stage: 'know' };
  const m = v.result.data?.measurement ?? v.listing?.meta?.['measurement'];
  return m && typeof m === 'object' ? (m as Dict) : null;
}
