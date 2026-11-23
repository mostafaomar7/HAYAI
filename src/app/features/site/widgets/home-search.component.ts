import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Dict, MenuItem, PageWidgets } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { arr, hrefOf } from '../site-utils';
import { icuPagePath } from './page-widgets';

/** Words that send the home search to the ICU page instead of the doctors. */
const ICU_WORDS = /\bicu\b|مركز[ةه]|رعاي[ةه]\s*مركز/i;

/**
 * The page that hosts the doctor search. Taken from the Home hero's own
 * buttons and the header menu (a link whose path ends in the doctor search
 * slug), so a renamed page still works as long as one of them points at it.
 */
export function findDoctorPath(locale: string, ...menus: (MenuItem[] | undefined)[]): string {
  const known = locale === 'ar' ? ['/ar/دور-على-دكتور'] : ['/en/find-a-doctor'];
  for (const m of menus) {
    for (const item of arr<MenuItem>(m)) {
      let h = hrefOf(item);
      try {
        h = decodeURI(h);
      } catch {}
      if (known.includes(h)) return h;
    }
  }
  return known[0];
}

/**
 * Build A: the hero search box (what you need + area) and the quick chips.
 *
 * A plain GET form to the doctor search page, so it works before hydration.
 * In the browser, ICU words go to the ICU page instead (its path is
 * Settings → Emergency bar's link). The chips are the `home-quick-chips` menu:
 * none while the admin has not created it.
 */
@Component({
  selector: 'site-home-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="search-box hero-search" role="search" method="get" [attr.action]="action()" (submit)="submit($event)">
      <label class="sb-field sb-grow">
        <span class="sr-only">{{ state.t('whatDoYouNeed') }}</span>
        <input type="search" name="q" [attr.placeholder]="state.t('whatDoYouNeed') + ' ' + state.t('homeSearchPlaceholder')" />
      </label>
      @if (areas().length) {
        <label class="sb-field">
          <span class="sr-only">{{ state.t('area') }}</span>
          <select name="area">
            <option value="">{{ state.t('allAreas') }}</option>
            @for (a of areas(); track a['key']) {
              <option [attr.value]="a['key']">{{ a['name'] }}</option>
            }
          </select>
        </label>
      }
      <button type="submit" class="btn btn-primary">{{ state.t('findCare') }}</button>
    </form>
    @if (chips().length) {
      <ul class="hero-chips" [attr.aria-label]="state.t('quickLinks')">
        @for (c of chips(); track $index) {
          <li><a [attr.href]="href(c)" [attr.target]="c.target || null">{{ c.label }}</a></li>
        }
      </ul>
    }
  `
})
export class HomeSearchComponent {
  readonly widgets = input<PageWidgets | null | undefined>(null);
  protected state = inject(SiteStateService);
  private router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected href = hrefOf;

  protected areas = computed(() => arr<Dict>(this.widgets()?.areas));
  protected chips = computed(() => arr<MenuItem>(this.state.site()?.menus?.['home-quick-chips']));
  protected action = computed(() => findDoctorPath(this.state.locale(), this.state.site()?.menus?.header, this.state.site()?.menus?.footer));

  protected submit(event: Event): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    const fd = new FormData(event.target as HTMLFormElement);
    const q = String(fd.get('q') ?? '').trim();
    const area = String(fd.get('area') ?? '').trim();
    const icu = icuPagePath(this.state.site());
    if (q && icu && ICU_WORDS.test(q)) {
      this.router.navigateByUrl(icu + (area ? `?area=${encodeURIComponent(area)}` : ''));
      return;
    }
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (area) p.set('area', area);
    const qs = p.toString();
    this.router.navigateByUrl(this.action() + (qs ? `?${qs}` : '') + '#doctor-results');
  }
}
