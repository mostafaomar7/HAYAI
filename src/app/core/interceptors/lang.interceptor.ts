import { HttpInterceptorFn } from '@angular/common/http';
import { readStoredLang } from '../i18n/i18n.service';

/**
 * Stamps the chosen language on every API call. The backend returns localized
 * display values in the same keys it always used — `name` on the option lists,
 * `vaccine_name` on the schedules — and picks the language from this header
 * alone. Without it the dashboard silently reads English while showing an
 * Arabic UI.
 *
 * Local asset requests are skipped: the dictionaries are fetched by path
 * (`assets/i18n/ar.json`), so the header would be noise on them.
 */
export const langInterceptor: HttpInterceptorFn = (req, next) => {
  if (!/^https?:/i.test(req.url)) return next(req);
  if (req.headers.has('Accept-Language')) return next(req);
  return next(req.clone({ headers: req.headers.set('Accept-Language', readStoredLang()) }));
};
