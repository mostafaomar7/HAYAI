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
 * - an IP address as the host. Nothing an advert points at is reached that
 *   way, and `http://127.0.0.1/` is a request aimed at whoever opens it.
 * - a backslash anywhere. Browsers read `\` in a URL as `/`, so
 *   `https://evil.test\@hayaihealthcare.com` is read as a path on
 *   `evil.test` while it reads to a person as the other way round. `URL`
 *   normalises some of these before we can see them, so the raw string is
 *   checked, not the parsed one.
 * - whitespace, control characters or invisible marks. A right-to-left
 *   override can make a link read backwards; a space can hide the rest.
 *
 * The last three came from the backend's reply of 2026-10-13, where the same
 * rules now run server-side. Both sides reject the same things on purpose: a
 * guard that is stricter than the boundary annoys people, and one that is
 * looser lets them get a 422 they could have been told about here.
 *
 * This runs in the browser, so it is a usability guard, not a security
 * boundary: anyone can post the same value with curl. The API checks it too.
 */

/**
 * Whitespace, C0/C1 controls, zero-width characters and the bidirectional
 * overrides. Built from code points rather than written literally: these are
 * by definition invisible in a source file, and one pasted into this regex
 * would be impossible to review.
 */
// A regex literal, not a string: `new RegExp('[\s')` loses the backslash
// and ends up matching the letter s, which is in every https link there is.
const HIDDEN = /[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;

export function httpUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = typeof control.value === 'string' ? control.value.trim() : '';
    if (!raw) return null;            // `required` is a separate decision

    // Before parsing: `URL` rewrites backslashes to slashes and percent-encodes
    // some of these, so by the time it has a URL object the evidence is gone.
    if (raw.indexOf(String.fromCharCode(92)) !== -1) {
      return { url: { reason: 'backslash' } };
    }
    if (HIDDEN.test(raw)) {
      return { url: { reason: 'whitespace' } };
    }

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
    if (isIpAddress(url.hostname)) {
      return { url: { reason: 'ip' } };
    }
    return null;
  };
}

/** IPv4 in dotted form, and IPv6, which `URL` hands back inside brackets. */
function isIpAddress(hostname: string): boolean {
  if (hostname.startsWith('[')) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}
