import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict, PageSection, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, str } from '../site-utils';
import { GetFormDirective, PagerComponent, pagination, submitOnChange, withQuery } from './widget-utils';

const FILTERS = ['area', 'insurer', 'service', 'icu_only'];

/**
 * Build C: hospital filters and one card per hospital account, in place of
 * the block that hosts it. The filter values come from `meta.filters`, which
 * lists only values the listed hospitals have, so a filter never leads to an
 * empty page. Empty (directory private, or no hospitals) renders nothing and
 * the page keeps its own block.
 */
@Component({
  selector: 'site-hospital-directory',
  imports: [SiteImageComponent, PagerComponent, GetFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="blk" id="hospital-results" aria-labelledby="hospital-results-h">
      <div class="wrap">
        <div class="results-head">
          <h2 class="blk-title" id="hospital-results-h">{{ heading() }}</h2>
          @if (filtered()) {
            <p class="muted">
              @if (total() !== null) { {{ state.t('nResults', total()!) }} · }
              <a [attr.href]="base() + '#hospital-results'">{{ state.t('clearFilters') }}</a>
            </p>
          }
        </div>

        @if (areas().length || insurers().length || services().length) {
          <form class="filters" method="get" siteGetForm [attr.action]="base() + '#hospital-results'">
            @if (areas().length) {
              <label>
                {{ state.t('area') }}
                <select name="area" (change)="submitOnChange($event)">
                  <option value="">{{ state.t('allAreas') }}</option>
                  @for (a of areas(); track a['key']) {
                    <option [attr.value]="a['key']" [attr.selected]="a['key'] === q()['area'] ? '' : null">{{ a['name'] }}</option>
                  }
                </select>
              </label>
            }
            @if (insurers().length) {
              <label>
                {{ state.t('insurance') }}
                <select name="insurer" (change)="submitOnChange($event)">
                  <option value="">{{ state.t('anyInsurance') }}</option>
                  @for (i of insurers(); track i['id']) {
                    <option [attr.value]="i['id']" [attr.selected]="'' + i['id'] === q()['insurer'] ? '' : null">{{ i['name'] }}</option>
                  }
                </select>
              </label>
            }
            @if (services().length) {
              <label>
                {{ state.t('services') }}
                <select name="service" (change)="submitOnChange($event)">
                  <option value="">{{ state.t('anyService') }}</option>
                  @for (s of services(); track s['key']) {
                    <option [attr.value]="s['key']" [attr.selected]="s['key'] === q()['service'] ? '' : null">{{ s['name'] }}</option>
                  }
                </select>
              </label>
            }
            <noscript><button type="submit" class="btn btn-outline btn-sm">{{ state.t('apply') }}</button></noscript>
          </form>
        }

        <div class="grid" style="--cols: 3">
          @for (h of hospitals(); track h['id']) {
            <article class="card hosp-card">
              <div class="hosp-head">
                @if (h['logo']) {
                  <span class="logo-plate"><site-img [image]="{ url: h['logo'], alt: h['name'], width: 64, height: 64 }" sizes="64px" cls="hosp-logo" /></span>
                }
                <div>
                  <h3 class="card-title"><a [attr.href]="h['path']">{{ h['name'] }}</a></h3>
                  <p class="hosp-sub">
                    @if (h['area']?.name) { <span>{{ h['area'].name }}</span> }
                    @if (h['is_verified']) { <span class="badge-verified">{{ state.t('verified') }}</span> }
                  </p>
                </div>
              </div>
              @if (arr(h['services']).length) {
                <ul class="chips">
                  @for (s of arr(h['services']).slice(0, 6); track $index) {
                    <li class="chip">{{ s['name'] }}</li>
                  }
                </ul>
              }
              @if (arr(h['insurers']).length) {
                <p class="muted"><strong>{{ state.t('insurersAccepted') }}:</strong> {{ names(h['insurers']) }}</p>
              }
              @if (updated(h)) {
                <p class="hosp-updated">{{ state.t('updatedOn', updated(h)) }}</p>
              }
              <a class="btn btn-outline btn-sm" [attr.href]="h['path']">{{ state.t('viewHospital') }}<span class="sr-only">: {{ h['name'] }}</span></a>
            </article>
          } @empty {
            <p class="muted">{{ state.t('noMatches') }}</p>
          }
        </div>
        <site-pager [meta]="widgets()?.hospitals?.meta" [base]="base()" [query]="q()" hash="#hospital-results" />
      </div>
    </section>
  `
})
export class HospitalDirectoryComponent {
  readonly widgets = input<PageWidgets | null | undefined>(null);
  readonly section = input<PageSection | null>(null);
  readonly base = input('');
  protected state = inject(SiteStateService);
  protected arr = arr;
  protected submitOnChange = submitOnChange;

  protected q = computed(() => this.widgets()?.query ?? {});
  protected filtered = computed(() => FILTERS.some(k => !!this.q()[k]));
  protected hospitals = computed(() => arr<Dict>(this.widgets()?.hospitals?.items));
  protected meta = computed(() => this.widgets()?.hospitals?.meta ?? null);
  protected total = computed(() => pagination(this.meta()).total);
  protected areas = computed(() => arr<Dict>(this.meta()?.['filters']?.areas));
  protected insurers = computed(() => arr<Dict>(this.meta()?.['filters']?.insurers));
  protected services = computed(() => arr<Dict>(this.meta()?.['filters']?.services));
  protected heading = computed(() => str(this.section()?.data?.['heading']) || this.state.t('hospitals'));

  protected names(list: Dict[]): string {
    return arr<Dict>(list).map(x => str(x['name'])).filter(Boolean).join(', ');
  }

  protected updated(h: Dict): string {
    const iso = str(h['updated_at']);
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(this.state.locale() === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  protected link(changes: Record<string, string>): string {
    return withQuery(this.base(), this.q(), changes, '#hospital-results');
  }
}
