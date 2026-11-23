import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict, PageSection, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, str } from '../site-utils';
import { GetFormDirective, PagerComponent, pagination, submitOnChange, withQuery } from './widget-utils';

const FILTERS = ['q', 'specialty', 'subspecialty', 'area', 'hospital'];

/**
 * Build B, the search form: in the page hero of the page that has the
 * Doctor list block. Filters live in the URL; results are server-rendered.
 */
@Component({
  selector: 'site-doctor-search',
  imports: [GetFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Specialties come back only while the doctor directory is public: no
         search box that could only ever find nothing. -->
    @if (specialties().length) {
      <form class="search-box" role="search" method="get" siteGetForm [attr.action]="base() + '#doctor-results'">
        <label class="sb-field sb-grow">
          <span class="sr-only">{{ state.t('doctorSearchPlaceholder') }}</span>
          <input type="search" name="q" [attr.value]="q()['q'] || ''" [attr.placeholder]="state.t('doctorSearchPlaceholder')" />
        </label>
        @if (specialties().length) {
          <label class="sb-field">
            <span class="sr-only">{{ state.t('specialty') }}</span>
            <select name="specialty">
              <option value="">{{ state.t('anySpecialty') }}</option>
              @for (s of specialties(); track s['slug']) {
                <option [attr.value]="s['slug']" [attr.selected]="s['slug'] === q()['specialty'] ? '' : null">{{ s['name'] }}</option>
              }
            </select>
          </label>
        }
        @if (areas().length) {
          <label class="sb-field">
            <span class="sr-only">{{ state.t('area') }}</span>
            <select name="area">
              <option value="">{{ state.t('allAreas') }}</option>
              @for (a of areas(); track a['key']) {
                <option [attr.value]="a['key']" [attr.selected]="a['key'] === q()['area'] ? '' : null">{{ a['name'] }}</option>
              }
            </select>
          </label>
        }
        @if (q()['subspecialty']) {
          <input type="hidden" name="subspecialty" [attr.value]="q()['subspecialty']" />
        }
        @if (q()['hospital']) {
          <input type="hidden" name="hospital" [attr.value]="q()['hospital']" />
        }
        <button type="submit" class="btn btn-primary">{{ state.t('search') }}</button>
      </form>
    }
  `
})
export class DoctorSearchComponent {
  readonly widgets = input<PageWidgets | null | undefined>(null);
  readonly base = input('');
  protected state = inject(SiteStateService);
  protected q = computed(() => this.widgets()?.query ?? {});
  protected specialties = computed(() => arr<Dict>(this.widgets()?.specialties));
  protected areas = computed(() => arr<Dict>(this.widgets()?.areas));
}

/**
 * Build B, results and browse grids, where the Doctor list block sits.
 * With filters in the URL: the matching doctors. Without: the specialty and
 * area grids, then the first page of doctors. While the directory is private
 * every endpoint is empty and this renders nothing.
 */
@Component({
  selector: 'site-doctor-directory',
  imports: [SiteImageComponent, PagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!filtered()) {
      @if (specialties().length) {
        <section class="blk theme-light" aria-labelledby="browse-spec">
          <div class="wrap">
            <h2 class="blk-title" id="browse-spec">{{ state.t('browseSpecialty') }}</h2>
            <ul class="tile-grid">
              @for (s of specialties(); track s['slug']) {
                <li class="tile">
                  <a class="tile-title" [attr.href]="link({ specialty: s['slug'] })">{{ s['name'] }}</a>
                  <p class="tile-meta">{{ counts(s) }}</p>
                  @if (arr(s['subspecialties']).length) {
                    <p class="tile-subs">
                      @for (sub of arr(s['subspecialties']); track sub['slug']; let last = $last) {
                        <a [attr.href]="link({ subspecialty: sub['slug'] })">{{ sub['name'] }}</a>@if (!last) {<span aria-hidden="true"> · </span>}
                      }
                    </p>
                  }
                </li>
              }
            </ul>
          </div>
        </section>
      }
      @if (areaCards().length) {
        <section class="blk" aria-labelledby="browse-area">
          <div class="wrap">
            <h2 class="blk-title" id="browse-area">{{ state.t('browseArea') }}</h2>
            <ul class="tile-grid">
              @for (a of areaCards(); track a['key']) {
                <li class="tile">
                  <a class="tile-title" [attr.href]="link({ area: a['key'] })">{{ a['name'] }}</a>
                  @if (a['doctors_count']) {
                    <p class="tile-meta">{{ doctorsText(a['doctors_count']) }}</p>
                  }
                  @if (arr(a['partners']).length) {
                    <p class="tile-subs">{{ arr(a['partners']).join(' · ') }}</p>
                  }
                </li>
              }
            </ul>
          </div>
        </section>
      }
    }

    @if (doctors().length || filtered()) {
      <section class="blk" id="doctor-results" aria-labelledby="doctor-results-h">
        <div class="wrap">
          <div class="results-head">
            <h2 class="blk-title" id="doctor-results-h">{{ heading() }}</h2>
            @if (filtered()) {
              <p class="muted">
                @if (total() !== null) { {{ state.t('nResults', total()!) }} · }
                <a [attr.href]="base() + '#doctor-results'">{{ state.t('clearFilters') }}</a>
              </p>
            }
          </div>
          <div class="grid" style="--cols: 3">
            @for (x of doctors(); track x['id']) {
              <article class="card doc-card">
                <div class="doc-head">
                  @if (x['image']) {
                    <site-img [image]="{ url: x['image'], alt: x['name'], width: 72, height: 72 }" sizes="72px" cls="avatar-md" />
                  } @else {
                    <span class="avatar-md avatar-blank" aria-hidden="true">{{ initials(x['name']) }}</span>
                  }
                  <div>
                    <h3 class="card-title"><a [attr.href]="x['path']">{{ x['name'] }}</a></h3>
                    @if (x['job_title']) {
                      <p class="doc-title">{{ x['job_title'] }}</p>
                    }
                  </div>
                </div>
                @if (specialtyLine(x)) {
                  <p class="doc-spec">{{ specialtyLine(x) }}</p>
                }
                @if (placeLine(x)) {
                  <p class="muted">{{ placeLine(x) }}</p>
                }
                @if (appHref()) {
                  <a class="btn btn-primary btn-sm" [attr.href]="appHref()">{{ state.t('requestAppointment') }}</a>
                }
              </article>
            } @empty {
              <p class="muted">{{ state.t('noMatches') }}</p>
            }
          </div>
          <site-pager [meta]="widgets()?.doctors?.meta" [base]="base()" [query]="q()" hash="#doctor-results" />
        </div>
      </section>
    }
  `
})
export class DoctorDirectoryComponent {
  readonly widgets = input<PageWidgets | null | undefined>(null);
  readonly section = input<PageSection | null>(null);
  readonly base = input('');
  protected state = inject(SiteStateService);
  protected arr = arr;
  protected submitOnChange = submitOnChange;

  protected q = computed(() => this.widgets()?.query ?? {});
  protected filtered = computed(() => FILTERS.some(k => !!this.q()[k]));
  protected doctors = computed(() => arr<Dict>(this.widgets()?.doctors?.items));
  protected total = computed(() => pagination(this.widgets()?.doctors?.meta).total);
  protected specialties = computed(() => arr<Dict>(this.widgets()?.specialties));
  /** Only areas with partners or listed doctors. */
  protected areaCards = computed(() =>
    arr<Dict>(this.widgets()?.areas).filter(a => arr(a['partners']).length || Number(a['doctors_count']) > 0)
  );
  protected heading = computed(() => str(this.section()?.data?.['heading']) || this.state.t('doctors'));
  /** "Request appointment" opens Get the app: there is no web booking. */
  protected appHref = computed(() => this.state.appHref());

  protected link(changes: Record<string, string>): string {
    return withQuery(this.base(), {}, changes, '#doctor-results');
  }

  protected counts(s: Dict): string {
    const parts = [this.doctorsText(s['doctors_count'])];
    const h = Number(s['hospitals_count']);
    if (h > 0) parts.push(h === 1 ? this.state.t('oneHospital') : this.state.t('nHospitals', h));
    return parts.filter(Boolean).join(' · ');
  }

  protected doctorsText(n: unknown): string {
    const c = Number(n);
    if (!(c > 0)) return '';
    return c === 1 ? this.state.t('oneDoctor') : this.state.t('nDoctors', c);
  }

  protected specialtyLine(x: Dict): string {
    return [str(x['specialty']?.name, x['specialty']), str(x['subspecialty']?.name, x['subspecialty'])].filter(Boolean).join(' · ');
  }

  /** First approved hospital · area. No fee, no languages: the data has neither. */
  protected placeLine(x: Dict): string {
    return [str(arr<Dict>(x['hospitals'])[0]?.['name']), str(x['area']?.name, x['location'])].filter(Boolean).join(' · ');
  }

  protected initials(name: string): string {
    return str(name)
      .replace(/^(dr\.?|د\.?)\s+/i, '')
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
