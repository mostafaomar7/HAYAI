import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict, ResolvedView } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, hrefOf, img, priceText, str } from '../site-utils';

/**
 * Listings: products, articles, search, directory indexes.
 *
 * Filters are a plain GET `<form>` and pagination is real `<a href="?page=2">`
 * links — never a JS-only "load more" — so every listing page is reachable by
 * a crawler. Canonical / robots for filtered or paginated URLs come from the
 * API (`meta.seo`) and are applied by the view; search is always noindex.
 */
@Component({
  selector: 'site-listing-page',
  imports: [SiteImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="wrap listing-head">
      <h1>{{ heading() }}</h1>
    </header>
    <div class="wrap">
      @switch (kind()) {
        @case ('search') {
          <form class="filters" role="search" method="get" [attr.action]="basePath()">
            <label>
              <span class="sr-only">{{ state.t('search') }}</span>
              <input type="search" name="q" [attr.value]="query()['q'] || ''" [attr.placeholder]="state.t('searchPlaceholder')" />
            </label>
            <button type="submit" class="btn btn-primary btn-sm">{{ state.t('search') }}</button>
          </form>
          @for (g of searchGroups(); track g.key) {
            <section class="result-group" [attr.aria-labelledby]="'res-' + g.key">
              <h2 class="h-sm" [attr.id]="'res-' + g.key">{{ state.t(g.label) }}</h2>
              <ul>
                @for (r of g.items; track $index) {
                  <li>
                    <a [attr.href]="href(r)">{{ str(r['title'], r['name']) }}</a>
                    @if (str(r['excerpt'], r['short_description'], r['description'])) {
                      <p class="muted">{{ str(r['excerpt'], r['short_description'], r['description']) }}</p>
                    }
                  </li>
                }
              </ul>
            </section>
          } @empty {
            @if (query()['q']) {
              <p class="muted">{{ state.t('noResults') }}</p>
            }
          }
        }
        @default {
          @if (kind() === 'products' && (categories().length || sorts().length)) {
            <form class="filters" method="get" [attr.action]="basePath()">
              @if (categories().length) {
                <label>
                  {{ state.t('allCategories') }}
                  <select name="category">
                    <option value="">{{ state.t('allCategories') }}</option>
                    @for (c of categories(); track $index) {
                      <option [attr.value]="c['slug'] ?? c['id']" [attr.selected]="(c['slug'] ?? '' + c['id']) === query()['category'] ? '' : null">{{ c['name'] }}</option>
                    }
                  </select>
                </label>
              }
              @if (sorts().length) {
                <label>
                  {{ state.t('sortBy') }}
                  <select name="sort">
                    @for (s of sorts(); track s) {
                      <option [attr.value]="s" [attr.selected]="s === query()['sort'] ? '' : null">{{ s }}</option>
                    }
                  </select>
                </label>
              }
              <button type="submit" class="btn btn-outline btn-sm">{{ state.t('apply') }}</button>
            </form>
          }

          <div class="grid" style="--cols: 3">
            @for (x of items(); track $index) {
              <article class="card">
                @if (img(x, 'featured_image', 'image', 'photo', 'logo')) {
                  <site-img [image]="img(x, 'featured_image', 'image', 'photo', 'logo')" [altText]="str(x['name'], x['title'])" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
                }
                <h2 class="card-title"><a [attr.href]="href(x)">{{ str(x['name'], x['title']) }}</a></h2>
                @if (str(x['short_description'], x['excerpt'], x['specialty']?.name, x['specialty'])) {
                  <p>{{ str(x['short_description'], x['excerpt'], x['specialty']?.name, x['specialty']) }}</p>
                }
                @if (priceText(x)) {
                  <p class="price-sm">{{ priceText(x) }}</p>
                }
                @if (str(x['availability']?.label)) {
                  <p class="avail" [attr.data-status]="x['availability']?.status">{{ x['availability']?.label }}</p>
                }
                @if (str(x['author']?.name, x['dates']?.display_published)) {
                  <p class="meta">
                    <span>{{ x['author']?.name }}</span>
                    <span>{{ x['dates']?.display_published }}</span>
                  </p>
                }
              </article>
            } @empty {
              <p class="muted">{{ state.t('noItems') }}</p>
            }
          </div>

          @if (lastPage() > 1) {
            <nav [attr.aria-label]="state.t('pagination')">
              <ul class="pager">
                @if (page() > 1) {
                  <li><a [attr.href]="pageHref(page() - 1)" rel="prev">{{ state.t('previous') }}</a></li>
                }
                @for (n of pages(); track n) {
                  <li>
                    @if (n === page()) {
                      <span aria-current="page">{{ n }}</span>
                    } @else {
                      <a [attr.href]="pageHref(n)" [attr.aria-label]="state.t('pageN', n)">{{ n }}</a>
                    }
                  </li>
                }
                @if (page() < lastPage()) {
                  <li><a [attr.href]="pageHref(page() + 1)" rel="next">{{ state.t('next') }}</a></li>
                }
              </ul>
            </nav>
          }
        }
      }
    </div>
  `
})
export class ListingPageComponent {
  readonly view = input.required<ResolvedView>();
  protected state = inject(SiteStateService);
  protected str = str;
  protected img = img;
  protected href = hrefOf;
  protected priceText = priceText;

  protected kind = computed(() => {
    const k = this.view().listing?.kind ?? '';
    return k === 'blog' ? 'articles' : k;
  });
  protected query = computed(() => this.view().listing?.query ?? {});
  protected items = computed(() => arr<Dict>(this.view().listing?.items));
  protected meta = computed(() => this.view().listing?.meta ?? null);
  protected categories = computed(() => arr<Dict>(this.meta()?.['filters']?.categories));
  protected sorts = computed(() => arr<string>(this.meta()?.['filters']?.sorts));
  protected page = computed(() => Number(this.meta()?.['pagination']?.current_page) || 1);
  protected lastPage = computed(() => Number(this.meta()?.['pagination']?.last_page) || 1);
  protected pages = computed(() => {
    const out: number[] = [];
    const from = Math.max(1, this.page() - 3);
    const to = Math.min(this.lastPage(), this.page() + 3);
    for (let i = from; i <= to; i++) out.push(i);
    return out;
  });
  protected basePath = computed(() => {
    const v = this.view();
    return encodeURI(`/${v.locale}${v.path === '/' ? '' : v.path}`);
  });
  protected heading = computed(() => {
    const k = this.kind();
    if (k === 'search') {
      const q = this.query()['q'];
      return q ? this.state.t('searchResultsFor', q) : this.state.t('search');
    }
    const map: Record<string, Parameters<SiteStateService['t']>[0]> = {
      products: 'products',
      articles: 'articles',
      doctors: 'doctors',
      hospitals: 'hospitals'
    };
    // The API's own title is localised and knows the facet — "Critical Care
    // Medicine doctors", "أطباء العناية المركزة" — where the map below only
    // ever says "Doctors". A facet page with the section's h1 is the same
    // page to a crawler as the section itself, so the API title wins and the
    // map stays as the fallback for when it is absent.
    const apiTitle = str(this.view().result?.data?.['title']);
    if (apiTitle) return apiTitle;
    return map[k] ? this.state.t(map[k]) : str(this.view().listing?.seo?.title) || this.state.t('products');
  });
  protected searchGroups = computed(() => {
    const results = (this.view().listing?.items as Dict)?.['results'] ?? {};
    const labels: Record<string, Parameters<SiteStateService['t']>[0]> = {
      pages: 'resultsPages',
      articles: 'resultsArticles',
      products: 'resultsProducts',
      doctors: 'resultsDoctors',
      hospitals: 'resultsHospitals'
    };
    return Object.keys(labels)
      .map(key => ({ key, label: labels[key], items: arr<Dict>(results[key]) }))
      .filter(g => g.items.length);
  });

  protected pageHref(n: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(this.query())) if (k !== 'page' && v) params.set(k, v);
    if (n > 1) params.set('page', String(n));
    const qs = params.toString();
    return this.basePath() + (qs ? `?${qs}` : '');
  }
}
