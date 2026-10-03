import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Dict } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';

/** Citations — a GEO signal answer engines use to weigh a page's claims. */
@Component({
  selector: 'site-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <section class="blk wrap sources" aria-labelledby="sources-h">
        <h2 id="sources-h" class="h-sm">{{ state.t('sources') }}</h2>
        <ol>
          @for (s of items(); track $index) {
            <li>
              @if (s.url) {
                <a [attr.href]="s.url" target="_blank" rel="noopener">{{ s.title || s.url }}</a>
              } @else {
                {{ s.title }}
              }
              @if (s.organization) { <span class="muted"> — {{ s.organization }}</span> }
              @if (s.published_on) { <span class="muted">, {{ s.published_on }}</span> }
              @if (s.verified_on) { <span class="muted"> ({{ state.t('verifiedOn') }} {{ s.verified_on }})</span> }
            </li>
          }
        </ol>
      </section>
    }
  `
})
export class SourcesListComponent {
  readonly items = input<any[]>([]);
  protected state = inject(SiteStateService);
}
