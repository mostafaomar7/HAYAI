import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GetFormDirective, submitOnChange } from './widget-utils';
import { Dict, WidgetList } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteStringKey } from '../i18n/site-strings';
import { arr, str } from '../site-utils';
import { icuPagePath } from './page-widgets';

/** Where the "Request an ICU bed" buttons land: the ICU page's form. */
export const ICU_FORM_ANCHOR = 'form-icu-bed-request';

/**
 * Live ICU availability (website 2026 §05): Home card, the ICU page list and
 * the hospital page tab.
 *
 * Statuses are the API's, derived from each branch's free-bed count. A row
 * without a count from the last 24 h (`is_fresh: false`) shows no status,
 * only "Call to confirm" with its hotline. Nothing here goes into JSON-LD.
 */
@Component({
  selector: 'site-icu-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'card') {
      @if (meta()?.['has_fresh'] && fresh().length) {
        <aside class="icu-card" aria-labelledby="icu-card-h">
          <p class="icu-card-kicker" id="icu-card-h">{{ state.t('icuAvailability') }}</p>
          <ul class="icu-rows">
            @for (r of fresh().slice(0, 3); track r['id']) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            }
          </ul>
          <a class="btn btn-primary btn-block" [attr.href]="requestHref()">{{ state.t('requestIcuBed') }}</a>
          @if (notice()) {
            <p class="icu-notice">{{ notice() }}</p>
          }
        </aside>
      }
    } @else if ((mode() === 'tab' && rows().length) || (mode() === 'list' && (meta()?.['has_fresh'] || area()))) {
      <section class="icu-list" [class.blk]="mode() === 'list'" aria-labelledby="icu-list-h">
        <div [class.wrap]="mode() === 'list'">
          @if (mode() === 'list') {
            <h2 class="blk-title" id="icu-list-h">{{ state.t('icuNow') }}</h2>
            @if (areas().length > 1) {
              <form class="filters icu-filter" method="get" siteGetForm [attr.action]="basePath() + '#icu-list-h'">
                <label>
                  {{ state.t('area') }}
                  <select name="area" (change)="submitOnChange($event)">
                    <option value="">{{ state.t('allAreas') }}</option>
                    @for (a of areas(); track a['key']) {
                      <option [attr.value]="a['key']" [attr.selected]="a['key'] === area() ? '' : null">{{ a['name'] }}</option>
                    }
                  </select>
                </label>
                <noscript><button type="submit" class="btn btn-outline btn-sm">{{ state.t('apply') }}</button></noscript>
              </form>
            }
          } @else {
            <h3 class="sr-only" id="icu-list-h">{{ state.t('icuNow') }}</h3>
          }
          <ul class="icu-rows icu-rows-lg">
            @for (r of rows(); track r['id']) {
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r, request: true }" />
            } @empty {
              <li class="muted">{{ state.t('noMatches') }} <a [attr.href]="basePath() + '#icu-list-h'">{{ state.t('clearFilters') }}</a></li>
            }
          </ul>
          @if (notice()) {
            <p class="icu-notice">{{ notice() }}</p>
          }
        </div>
      </section>
    }

    <ng-template #row let-r let-request="request">
      <li class="icu-row" [attr.data-status]="r['is_fresh'] ? r['status'] : 'unknown'">
        <div class="icu-row-main">
          <p class="icu-name">{{ name(r) }}</p>
          <p class="icu-meta">
            @if (r['is_fresh']) {
              <span>{{ updated(r) }}</span>
            } @else {
              <span>{{ state.t('callToConfirm') }}</span>
              @if (r['hotline']) {
                · <a [attr.href]="'tel:' + tel(r['hotline'])" dir="ltr">{{ r['hotline'] }}</a>
              }
            }
            @if (arr(r['icu_types']).length) {
              <span class="icu-types"> · {{ arr(r['icu_types']).join(', ') }}</span>
            }
          </p>
        </div>
        @if (r['is_fresh'] && r['status']) {
          <span class="pill" [attr.data-status]="r['status']">{{ statusLabel(r['status']) }}</span>
        }
        @if (request && r['is_fresh'] && r['status'] !== 'full') {
          <a class="btn btn-outline btn-sm" [attr.href]="requestHref()">{{ state.t('requestIcuBed') }}</a>
        }
      </li>
    </ng-template>
  `,
  imports: [NgTemplateOutlet, GetFormDirective]
})
export class IcuListComponent {
  readonly data = input<WidgetList | null | undefined>(null);
  /** card: Home hero. list: a page section. tab: inside the hospital page. */
  readonly mode = input<'card' | 'list' | 'tab'>('list');
  readonly basePath = input('');
  readonly area = input('');
  /** The form is on this same page: link to it without leaving. */
  readonly formOnPage = input(false);

  protected state = inject(SiteStateService);
  protected arr = arr;
  protected submitOnChange = submitOnChange;

  protected rows = computed(() => arr<Dict>(this.data()?.items));
  protected fresh = computed(() => this.rows().filter(r => r['is_fresh'] && r['status']));
  protected meta = computed(() => this.data()?.meta ?? null);
  protected areas = computed(() => arr<Dict>(this.meta()?.['areas']));
  protected notice = computed(() => str(this.meta()?.['notice']));
  protected requestHref = computed(() => {
    if (this.formOnPage()) return `#${ICU_FORM_ANCHOR}`;
    const path = icuPagePath(this.state.site());
    return path ? `${path}#${ICU_FORM_ANCHOR}` : `#${ICU_FORM_ANCHOR}`;
  });

  protected name(r: Dict): string {
    const h = str(r['hospital']?.name, r['centre_name']);
    const branch = str(r['branch_name'], r['area']?.name);
    return branch && branch !== h ? `${h} · ${branch}` : h;
  }

  protected updated(r: Dict): string {
    const m = Number(r['updated_minutes_ago']);
    if (!isFinite(m) || r['updated_minutes_ago'] === null) return '';
    if (m < 1) return this.state.t('updatedJustNow');
    if (m < 60) return this.state.t('updatedMin', Math.round(m));
    return this.state.t('updatedHours', Math.floor(m / 60));
  }

  protected statusLabel(s: string): string {
    return this.state.t(`st_${s}` as SiteStringKey) || s;
  }

  protected tel(n: string): string {
    return String(n).replace(/[^\d+]/g, '');
  }
}
