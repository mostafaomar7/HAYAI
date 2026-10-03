import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { FormDefinition } from '../models/site.models';
import { SiteStateService } from '../services/site-state.service';
import { SiteApiService } from '../services/site-api.service';
import { SiteFormComponent } from '../ui/site-form.component';

/**
 * An inline CMS form. `contact_form` and `hospital_partner_cta` blocks carry the
 * full definition in `data.form`; it is also remembered in the page state so a
 * CTA with `action.kind: "form"` for the same key scrolls to it. Given only a
 * key, the definition comes from the page's `forms`, else it is fetched —
 * during the server render too, so the form is in the first HTML either way.
 */
@Component({
  selector: 'site-form-block',
  imports: [SiteFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (definition(); as f) {
      <site-form [form]="f" [anchorId]="'form-' + f.key" idPrefix="in" [showTitle]="showTitle()" />
    }
  `
})
export class FormBlockComponent {
  readonly form = input<FormDefinition | null>(null);
  readonly formKey = input<string | null>(null);
  readonly showTitle = input(false);
  private state = inject(SiteStateService);
  private api = inject(SiteApiService);
  protected definition = computed(() => this.form() ?? this.state.form(this.formKey()));

  constructor() {
    effect(() => {
      const own = this.form();
      if (own) {
        if (!this.state.form(own.key)) this.state.rememberForm(own);
        return;
      }
      const key = this.formKey();
      if (key && !this.state.form(key)) {
        this.api.form(this.state.locale(), key).subscribe(def => def && this.state.rememberForm(def));
      }
    });
  }
}
