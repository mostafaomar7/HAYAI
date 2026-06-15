import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string | null | undefined): string {
    if (!key) return '';
    return this.i18n.translate(key);
  }
}
