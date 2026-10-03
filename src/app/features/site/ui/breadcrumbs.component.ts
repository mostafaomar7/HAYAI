import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SiteStateService } from '../services/site-state.service';
import { hrefOf } from '../site-utils';

/** Visible breadcrumb trail (the BreadcrumbList JSON-LD comes from the API). */
@Component({
  selector: 'site-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 1) {
      <nav class="crumbs wrap" [attr.aria-label]="state.t('breadcrumbs')">
        <ol>
          @for (c of items(); track $index; let last = $last) {
            <li>
              @if (!last) {
                <a [attr.href]="href(c)">{{ c.name }}</a>
              } @else {
                <span aria-current="page">{{ c.name }}</span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `
})
export class BreadcrumbsComponent {
  readonly items = input<{ name: string; url?: string; path?: string }[]>([]);
  protected state = inject(SiteStateService);
  protected href = hrefOf;
}
