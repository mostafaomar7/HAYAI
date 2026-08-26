import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Public holding page shown at the domain root while the marketing site is
 * unpublished.
 *
 * This REPLACES the landing page on the route rather than covering it. An
 * overlay would still ship the real page to every visitor, and anyone could
 * delete the overlay node from devtools and read what is underneath. The
 * landing component is simply not routed, so its lazy chunk is never built and
 * never reaches the browser — there is nothing behind this page to reveal.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.css'
})
export class ComingSoonComponent {
  i18n = inject(I18nService);

  /**
   * The only working contacts while the site is parked, so they are held here
   * rather than in the dictionaries — a contact detail is not a translation,
   * and duplicating it per language is how one of them ends up stale.
   */
  readonly phone = '+20 103 657 0577';
  readonly email = 'islam@hayaihealthcare.com';

  /** wa.me takes digits only — no plus sign, no spaces. */
  readonly whatsappHref = `https://wa.me/${this.phone.replace(/\D/g, '')}`;
}
