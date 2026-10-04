import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SiteCta } from '../models/site.models';
import { SiteCtaService, ctaView } from '../services/site-cta.service';

/**
 * One call-to-action. Always rendered as a real `<a href>` so it works (and is
 * crawlable) before hydration; form / purchase CTAs are upgraded to open the
 * form or the purchase dialog once the page is interactive.
 */
@Component({
  selector: 'site-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as c) {
      <a
        class="btn"
        [class]="'btn btn-' + c.style + (size() ? ' btn-' + size() : '')"
        [attr.href]="c.href"
        [attr.target]="c.target"
        [attr.rel]="c.rel"
        [attr.data-cta]="c.trackingKey"
        (click)="ctas.activate(c, placement(), $event)"
      >
        <span class="btn-label">{{ c.label }}</span>
        @if (c.sublabel) {
          <small class="btn-sub">{{ c.sublabel }}</small>
        }
      </a>
    }
  `
})
export class CtaButtonComponent {
  readonly cta = input<SiteCta | null | undefined>(null);
  readonly placement = input('inline');
  readonly size = input<'' | 'lg' | 'block'>('');
  protected ctas = inject(SiteCtaService);
  protected view = computed(() => ctaView(this.cta()));
}
