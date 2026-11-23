import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Dict, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteStringKey } from '../i18n/site-strings';
import { BreadcrumbsComponent } from '../ui/breadcrumbs.component';
import { SiteImageComponent } from '../ui/site-image.component';
import { arr, str } from '../site-utils';
import { IcuListComponent, ICU_FORM_ANCHOR } from '../widgets/icu-list.component';
import { icuPagePath } from '../widgets/page-widgets';

interface Tab {
  id: string;
  label: SiteStringKey;
}

/**
 * Build D: a partner hospital's page with a sticky tab bar. Every tab with no
 * data is left out. Reviews and FAQ are always out: there are no verified
 * patient reviews of hospitals and no per-hospital FAQ data. "Prices" has no
 * data either, so that tab lists insurers only. The `Hospital` JSON-LD comes
 * from the API's `schema_script` (printed by the view); nothing is added.
 */
@Component({
  selector: 'site-hospital-page',
  imports: [BreadcrumbsComponent, SiteImageComponent, IcuListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hospital();
    <header class="page-hero">
      <div class="wrap">
        <site-breadcrumbs [items]="arr(h['breadcrumbs'])" />
        <div class="hosp-hero">
          @if (h['logo']) {
            <span class="logo-plate logo-plate-lg">
              <site-img [image]="{ url: h['logo'], alt: h['name'], width: 96, height: 96 }" [priority]="true" sizes="96px" cls="hosp-logo-lg" />
            </span>
          }
          <div>
            <h1>{{ str(h['h1']?.text, h['name']) }}</h1>
            <p class="lead">
              @if (str(h['address'], h['location'])) { <span>{{ str(h['address'], h['location']) }}</span> }
              @if (h['is_verified']) { <span class="badge-verified badge-on-dark">{{ state.t('verifiedPartner') }}</span> }
            </p>
          </div>
        </div>
        <div class="cta-row">
          @if (appHref()) {
            <a class="btn btn-primary btn-lg" [attr.href]="appHref()">{{ state.t('requestAppointment') }}</a>
          }
          @if (icuHref()) {
            <a class="btn btn-outline-light btn-lg" [attr.href]="icuHref()">{{ state.t('requestIcuBed') }}</a>
          }
          @if (whatsapp()) {
            <a class="btn btn-outline-light btn-lg" [attr.href]="whatsapp()" target="_blank" rel="noopener">{{ state.t('whatsappUs') }}</a>
          }
        </div>
      </div>
    </header>

    <nav class="tabbar" [attr.aria-label]="state.t('hospitalSections')">
      <ul class="wrap">
        @for (t of tabs(); track t.id) {
          <li><a [attr.href]="'#' + t.id">{{ state.t(t.label) }}</a></li>
        }
      </ul>
    </nav>

    <section class="blk tab-panel" id="overview" aria-labelledby="overview-h">
      <div class="wrap">
        <h2 class="blk-title" id="overview-h">{{ state.t('tabOverview') }}</h2>
        <dl class="key-facts">
          @if (str(h['address'])) {
            <div><dt>{{ state.t('address') }}</dt><dd>{{ h['address'] }}</dd></div>
          }
          @if (h['area']?.name) {
            <div><dt>{{ state.t('area') }}</dt><dd>{{ h['area'].name }}</dd></div>
          }
          @if (str(h['phone'])) {
            <div><dt>{{ state.t('phone') }}</dt><dd><a [attr.href]="'tel:' + tel(h['phone'])" dir="ltr">{{ h['phone'] }}</a></dd></div>
          }
          @if (str(h['emergency_number'])) {
            <div><dt>{{ state.t('emergencyNumber') }}</dt><dd><a [attr.href]="'tel:' + tel(h['emergency_number'])" dir="ltr">{{ h['emergency_number'] }}</a></dd></div>
          }
        </dl>
        @if (str(h['description'], h['about'])) {
          <div class="prose" [innerHTML]="str(h['description'], h['about'])"></div>
        }
      </div>
    </section>

    @if (icuRows().length) {
      <section class="blk tab-panel theme-light" id="icu" aria-labelledby="icu-h">
        <div class="wrap">
          <h2 class="blk-title" id="icu-h">{{ state.t('tabIcu') }}</h2>
          <site-icu-list mode="tab" [data]="widgets()?.icu" />
        </div>
      </section>
    }

    @if (centres().length) {
      <section class="blk tab-panel" id="centres" aria-labelledby="centres-h">
        <div class="wrap">
          <h2 class="blk-title" id="centres-h">{{ state.t('tabCentres') }}</h2>
          <ul class="chips chips-lg">
            @for (c of centres(); track $index) {
              <li class="chip">{{ c }}</li>
            }
          </ul>
        </div>
      </section>
    }

    @if (doctorGroups().length) {
      <section class="blk tab-panel theme-light" id="doctors" aria-labelledby="doctors-h">
        <div class="wrap">
          <h2 class="blk-title" id="doctors-h">{{ state.t('tabDoctors') }}</h2>
          @for (g of doctorGroups(); track g.name) {
            <h3 class="group-h">{{ g.name }}</h3>
            <ul class="doc-mini">
              @for (d of g.doctors; track d['id']) {
                <li>
                  <a [attr.href]="d['path']">{{ d['name'] }}</a>
                  @if (str(d['subspecialty']?.name, d['subspecialty'], d['job_title'])) {
                    <span class="muted"> · {{ str(d['subspecialty']?.name, d['subspecialty'], d['job_title']) }}</span>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </section>
    }

    @if (insurers().length) {
      <section class="blk tab-panel" id="insurance" aria-labelledby="insurance-h">
        <div class="wrap">
          <h2 class="blk-title" id="insurance-h">{{ state.t('tabInsurance') }}</h2>
          <ul class="chips chips-lg">
            @for (i of insurers(); track $index) {
              <li class="chip">{{ i }}</li>
            }
          </ul>
        </div>
      </section>
    }

    <section class="blk tab-panel theme-brand" id="request" aria-labelledby="request-h">
      <div class="wrap request-band">
        <h2 class="blk-title" id="request-h">{{ state.t('tabRequest') }}</h2>
        <div class="cta-row">
          @if (appHref()) {
            <a class="btn btn-primary btn-lg" [attr.href]="appHref()">{{ state.t('requestAppointment') }}</a>
          }
          @if (icuHref()) {
            <a class="btn btn-secondary btn-lg" [attr.href]="icuHref()">{{ state.t('requestIcuBed') }}</a>
          }
        </div>
      </div>
    </section>
  `
})
export class HospitalPageComponent {
  readonly hospital = input.required<Dict>();
  readonly widgets = input<PageWidgets | null | undefined>(null);
  protected state = inject(SiteStateService);
  protected str = str;
  protected arr = arr;

  protected icuRows = computed(() => arr<Dict>(this.widgets()?.icu?.items));
  protected doctors = computed(() => arr<Dict>(this.widgets()?.doctors?.items));
  protected centres = computed(() =>
    arr<unknown>(this.hospital()['specialties']).map(s => (typeof s === 'string' ? s : str((s as Dict)?.['name']))).filter(Boolean)
  );
  protected insurers = computed(() => arr<Dict>(this.hospital()['insurers']).map(i => str(i?.['name'])).filter(Boolean));
  /** Doctors grouped by specialty. */
  protected doctorGroups = computed(() => {
    const groups = new Map<string, Dict[]>();
    for (const d of this.doctors()) {
      const k = str(d['specialty']?.name, d['specialty']) || '—';
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    return [...groups.entries()].map(([name, doctors]) => ({ name, doctors }));
  });
  protected tabs = computed<Tab[]>(() => {
    const t: Tab[] = [{ id: 'overview', label: 'tabOverview' }];
    if (this.icuRows().length) t.push({ id: 'icu', label: 'tabIcu' });
    if (this.centres().length) t.push({ id: 'centres', label: 'tabCentres' });
    if (this.doctorGroups().length) t.push({ id: 'doctors', label: 'tabDoctors' });
    if (this.insurers().length) t.push({ id: 'insurance', label: 'tabInsurance' });
    t.push({ id: 'request', label: 'tabRequest' });
    return t;
  });
  protected appHref = computed(() => this.state.appHref());
  protected icuHref = computed(() => {
    const p = icuPagePath(this.state.site());
    return p ? `${p}#${ICU_FORM_ANCHOR}` : null;
  });
  protected whatsapp = computed(() => {
    const n = str(this.state.site()?.organization?.whatsapp).replace(/\D/g, '');
    return n ? `https://wa.me/${n}` : null;
  });

  protected tel(n: string): string {
    return String(n).replace(/[^\d+]/g, '');
  }
}
