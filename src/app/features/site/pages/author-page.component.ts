import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { arr, hrefOf, img, str } from '../site-utils';

/**
 * Author archive. Named, credentialed authors with `sameAs` profiles are an
 * E-E-A-T / GEO trust signal for health content, so bio, credentials and the
 * external profiles are all visible text (and mirrored in the API's Person
 * JSON-LD).
 */
@Component({
  selector: 'site-author-page',
  imports: [SiteImageComponent, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = author();
    <site-breadcrumbs [items]="arr(a['breadcrumbs'])" />
    <header class="wrap author-head">
      @if (photo()) {
        <site-img [image]="photo()" [priority]="true" sizes="96px" cls="avatar-lg" />
      }
      <div>
        <h1>{{ str(a['h1']?.text, a['name']) }}</h1>
        @if (str(a['job_title'])) {
          <p class="lead">{{ a['job_title'] }}</p>
        }
        @if (str(a['credentials'])) {
          <p class="muted"><span class="sr-only">{{ state.t('credentials') }}: </span>{{ a['credentials'] }}</p>
        }
      </div>
    </header>
    <div class="wrap">
      @if (str(a['bio'])) {
        <div class="prose" [innerHTML]="a['bio']"></div>
      }
      @if (sameAs().length) {
        <ul class="sameas">
          @for (u of sameAs(); track u) {
            <li><a [attr.href]="u" target="_blank" rel="me noopener">{{ u.replace('https://', '').replace('www.', '') }}</a></li>
          }
        </ul>
      }
      @if (articles().length) {
        <section class="blk" aria-labelledby="author-articles">
          <h2 id="author-articles" class="blk-title">{{ state.t('articlesBy', str(a['name'])) }}</h2>
          <div class="grid" style="--cols: 3">
            @for (x of articles(); track $index) {
              <article class="card">
                @if (img(x, 'featured_image', 'image')) {
                  <site-img [image]="img(x, 'featured_image', 'image')" sizes="(min-width: 960px) 33vw, 100vw" cls="card-img" />
                }
                <h3 class="card-title"><a [attr.href]="href(x)">{{ x['title'] }}</a></h3>
                @if (str(x['excerpt'])) {
                  <p>{{ x['excerpt'] }}</p>
                }
                @if (str(x['dates']?.display_published, x['display_published'])) {
                  <p class="meta">{{ str(x['dates']?.display_published, x['display_published']) }}</p>
                }
              </article>
            }
          </div>
        </section>
      }
    </div>
  `
})
export class AuthorPageComponent {
  readonly author = input.required<Dict>();
  protected state = inject(SiteStateService);
  protected str = str;
  protected arr = arr;
  protected img = img;
  protected href = hrefOf;
  protected photo = computed(() => img(this.author(), 'photo', 'image'));
  protected sameAs = computed(() => arr<string>(this.author()['same_as']).filter(u => typeof u === 'string'));
  protected articles = computed(() => arr<Dict>(this.author()['articles'], this.author()['latest_articles']));
}
