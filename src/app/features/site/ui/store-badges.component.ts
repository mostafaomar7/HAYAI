import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SiteStateService } from '../services/site-state.service';
import { str } from '../site-utils';

/**
 * Official Google Play / App Store badges (self-hosted), linking to
 * `site.apps`. A store without a URL gets no badge. Google's badge has an
 * Arabic version; Apple's localized badge is not in the repo yet, so Arabic
 * pages use the English one, which Apple's guidelines allow.
 */
@Component({
  selector: 'site-store-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (play() || appStore()) {
      <ul class="store-badges" [class.store-badges-lg]="size() === 'lg'" [attr.aria-label]="state.t('storeBadges')">
        @if (appStore()) {
          <li>
            <a [attr.href]="appStore()" target="_blank" rel="noopener">
              <img src="/brand/badges/app-store-en.svg" [attr.alt]="state.t('appStoreAlt')" width="120" height="40" loading="lazy" />
            </a>
          </li>
        }
        @if (play()) {
          <li>
            <a [attr.href]="play()" target="_blank" rel="noopener">
              <img [attr.src]="'/brand/badges/google-play-' + state.locale() + '.png'" [attr.alt]="state.t('googlePlayAlt')" width="155" height="60" loading="lazy" class="badge-play" />
            </a>
          </li>
        }
      </ul>
    }
  `
})
export class StoreBadgesComponent {
  readonly size = input<'' | 'lg'>('');
  protected state = inject(SiteStateService);
  protected play = computed(() => str(this.state.site()?.apps?.google_play_url) || null);
  protected appStore = computed(() => str(this.state.site()?.apps?.app_store_url) || null);
}
