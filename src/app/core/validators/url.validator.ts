import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * A link an admin types that somebody else's device will open.
 *
 * The advertisement redirect is the case this was written for: the dashboard
 * shows it as text and the website does not render ads at all, so nothing
 * here can execute it — but the patient and partner apps open it directly,
 * with no sanitiser between the stored string and the browser they hand it
 * to. So this is about what is safe to send someone, not about what is safe
 * to render.
 *
 * Rejected, and why each one:
 *
 * - anything that is not `http` or `https` — `javascript:`, `data:`,
 *   `intent:`, `file:`. None of them belong in an advert, and the apps have
 *   no reason to be asked to open one.
 * - a URL carrying credentials, `https://hayaihealthcare.com@evil.test`.
 *   The part a person reads is the username; the host is the last one. It is
 *   the oldest phishing trick there is and it looks perfectly ordinary.
 * - a host with no dot, which is either a typo or an internal name.
 *
 * This runs in the browser, so it is a usability guard, not a security
 * boundary: anyone can post the same value with curl. The API has to check
 * it as well, which is written up in the backend contract.
 */
export function httpUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = typeof control.value === 'string' ? control.value.trim() : '';
    if (!raw) return null;            // `required` is a separate decision

    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { url: { reason: 'malformed' } };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { url: { reason: 'scheme' } };
    }
    if (url.username || url.password) {
      return { url: { reason: 'credentials' } };
    }
    if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
      return { url: { reason: 'host' } };
    }
    return null;
  };
}
