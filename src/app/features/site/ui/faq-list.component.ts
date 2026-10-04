import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Dict } from '../models/site.models';

/**
 * FAQs as `<details>/<summary>`: the full answer is in the initial HTML and
 * only collapsed by the browser — crawlers and answer engines read every
 * answer, and the FAQPage JSON-LD (built by the API) matches visible text.
 */
@Component({
  selector: 'site-faq-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="faq-list">
      @for (f of items(); track $index) {
        @if (f?.question) {
          <details class="faq-item" [attr.open]="$first && openFirst() ? '' : null">
            <summary>
              <h3 class="faq-q">{{ f.question }}</h3>
            </summary>
            <div class="faq-a prose" [innerHTML]="f.answer"></div>
          </details>
        }
      }
    </div>
  `
})
export class FaqListComponent {
  readonly items = input<any[]>([]);
  readonly openFirst = input(false);
}
