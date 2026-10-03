import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SiteImage } from '../models/site.models';

/**
 * Responsive image from a resolved CMS media object.
 *
 * - `width`/`height` attributes always set when known, so the browser reserves
 *   the box before the file arrives (no layout shift / CLS).
 * - `srcset`/`sizes` from the API's WebP variants.
 * - Lazy by default; the hero (LCP candidate) passes `priority` and gets
 *   `fetchpriority="high"` + eager loading instead.
 */
@Component({
  selector: 'site-img',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (image()?.url) {
      <img
        [attr.src]="image()!.url"
        [attr.srcset]="srcset()"
        [attr.sizes]="srcset() ? sizes() : null"
        [attr.width]="image()!.width || null"
        [attr.height]="image()!.height || null"
        [attr.alt]="alt()"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : null"
        decoding="async"
        [class]="cls()"
      />
    }
  `
})
export class SiteImageComponent {
  readonly image = input<SiteImage | null | undefined>(null);
  readonly sizes = input('100vw');
  readonly priority = input(false);
  readonly cls = input('');
  /** Overrides the media alt (e.g. a logo named by its item). */
  readonly altText = input<string | null>(null);

  protected srcset = computed(() => {
    const img = this.image();
    if (!img) return null;
    if (img.srcset) return img.srcset;
    const v = img.variants?.filter(x => x?.url && x.width);
    return v?.length ? v.map(x => `${x.url} ${x.width}w`).join(', ') : null;
  });
  protected alt = computed(() => this.altText() ?? this.image()?.alt ?? '');
}
