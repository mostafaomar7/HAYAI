import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict, PageSection, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, str } from '../site-utils';
import { GetFormDirective, PagerComponent, pagination, withQuery } from './widget-utils';

/**
 * Build G: guide search, category chips and guide cards, in place of the
 * Article list block anchored `guides`. `q` matches title and summary; an
 * unknown category returns no rows.
 */
@Component({
  selector: 'site-guides',
  imports: [SiteImageComponent, PagerComponent, GetFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="blk" id="guides" aria-labelledby="guides-h">
      <div class="wrap">
        <h2 class="blk-title" id="guides-h">{{ heading() }}</h2>
        <form class="search-box search-box-inline" role="search" method="get" siteGetForm [attr.action]="base() + '#guides'">
          <label class="sb-field sb-grow">
            <span class="sr-only">{{ state.t('searchGuides') }}</span>
            <input type="search" name="q" [attr.value]="q()['q'] || ''" [attr.placeholder]="state.t('searchGuides')" />
          </label>
          @if (q()['category']) {
            <input type="hidden" name="category" [attr.value]="q()['category']" />
          }
          <button type="submit" class="btn btn-primary">{{ state.t('search') }}</button>
        </form>
        @if (categories().length) {
          <ul class="chip-links" [attr.aria-label]="state.t('allCategories')">
            <li><a [attr.href]="link(null)" [attr.aria-current]="!q()['category'] ? 'page' : null">{{ state.t('allTopics') }}</a></li>
            @for (c of categories(); track c['slug']) {
              <li><a [attr.href]="link(c['slug'])" [attr.aria-current]="c['slug'] === q()['category'] ? 'page' : null">{{ c['name'] }}</a></li>
            }
          </ul>
        }
        @if (filtered()) {
          <p class="muted results-count">
            @if (total() !== null) { {{ state.t('nResults', total()!) }} · }
            <a [attr.href]="base() + '#guides'">{{ state.t('clearFilters') }}</a>
          </p>
        }
        <div class="grid" style="--cols: 3">
          @for (a of articles(); track a['id']) {
            <article class="card guide-card">
              @if (a['image']) {
                <site-img [image]="a['image']" [altText]="a['title']" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
              }
              @if (a['category']?.name) {
                <p class="eyebrow">{{ a['category'].name }}</p>
              }
              <h3 class="card-title"><a [attr.href]="a['path']">{{ a['title'] }}</a></h3>
              @if (a['excerpt']) {
                <p>{{ a['excerpt'] }}</p>
              }
              <p class="meta">
                @if (a['author']?.name) {
                  <span>{{ state.t('reviewedBy', a['author'].name) }}</span>
                }
                @if (date(a['modified_at'] || a['published_at'])) {
                  <time [attr.datetime]="a['modified_at'] || a['published_at']">{{ state.t('updatedOn', date(a['modified_at'] || a['published_at'])) }}</time>
                }
              </p>
            </article>
          } @empty {
            <p class="muted">{{ state.t('noMatches') }}</p>
          }
        </div>
        <site-pager [meta]="widgets()?.articles?.meta" [base]="base()" [query]="q()" hash="#guides" />
      </div>
    </section>
  `
})
export class GuidesComponent {
  readonly widgets = input<PageWidgets | null | undefined>(null);
  readonly section = input<PageSection | null>(null);
  readonly base = input('');
  protected state = inject(SiteStateService);

  protected q = computed(() => this.widgets()?.query ?? {});
  protected filtered = computed(() => !!(this.q()['q'] || this.q()['category']));
  protected articles = computed(() => arr<Dict>(this.widgets()?.articles?.items));
  protected categories = computed(() => arr<Dict>(this.widgets()?.categories).filter(c => c['slug'] && c['name']));
  protected total = computed(() => pagination(this.widgets()?.articles?.meta).total);
  protected heading = computed(() => str(this.section()?.data?.['heading']) || this.state.t('articles'));

  protected link(category: string | null): string {
    return withQuery(this.base(), { q: this.q()['q'] ?? '' }, { category }, '#guides');
  }

  protected date(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(this.state.locale() === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
