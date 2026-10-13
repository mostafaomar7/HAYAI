import { Injectable, signal, computed, inject, DOCUMENT, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'hayai_lang';

/**
 * The chosen language, read straight from storage. The HTTP interceptor needs
 * it to stamp `Accept-Language` on every request, and it cannot inject
 * `I18nService` to ask: the very first request the app makes is this service's
 * own dictionary fetch, issued from its constructor, so the interceptor would
 * be asking for a service that is still being built.
 */
export function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {}
  // `typeof` rather than `navigator?.`: on the SSR server (Node 20) the global
  // does not exist at all, and optional chaining does not guard an undeclared
  // identifier — it would throw a ReferenceError while rendering.
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
  return (browserLang ?? 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private http = inject(HttpClient);
  private document = inject(DOCUMENT);

  readonly lang = signal<Lang>(this.detectInitial());
  private readonly dict = signal<Record<string, string>>({});
  /**
   * Whether a dictionary has been answered for — not whether it arrived.
   * A failed fetch settles this too, so a broken deploy shows the keys rather
   * than a page of blanks with nothing to go on.
   */
  private readonly settled = signal(false);

  readonly isRtl = computed(() => this.lang() === 'ar');
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.isRtl() ? 'rtl' : 'ltr'));

  constructor() {
    // Dashboard-only service. The SSR server renders just the public website,
    // whose language comes from the URL — never from storage — so on the
    // server this must neither stamp `<html lang dir>` nor fetch dictionaries
    // by a relative URL (which has no origin to resolve against in Node).
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.applyDocumentAttrs(this.lang());
    this.load(this.lang());
  }

  setLang(next: Lang) {
    if (next === this.lang()) return;
    this.lang.set(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    this.applyDocumentAttrs(next);
    this.load(next);
  }

  toggle() {
    this.setLang(this.lang() === 'en' ? 'ar' : 'en');
  }

  /**
   * Looks up `key` and substitutes `{name}` placeholders from `params`.
   * An unknown key falls back to itself, so passing a literal string through
   * `translate` is safe (used for backend-supplied messages).
   */
  translate(key: string, params?: Record<string, string | number>): string {
    const value = this.dict()[key];
    const text = value === undefined || value === '' ? this.fallback(key) : value;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] === undefined ? match : String(params[name])
    );
  }

  /**
   * What to show for a key with no translation.
   *
   * The dictionary is fetched after the bundle boots, so for the first moment
   * of a cold load there is nothing to look anything up in. Every label on the
   * page rendered as its own key — a sidebar reading `menu.advertisements`,
   * `common.search`, `reports.title`. It looks like a broken build, and it is
   * what the QA round saw underneath the slow first paint.
   *
   * Until the first dictionary settles, a key is rendered as nothing: a label
   * that has not arrived yet, which is the truth. Anything that is not shaped
   * like a key still passes through, because `translate` is also how
   * backend-supplied messages reach the page and those must never be
   * swallowed. After that first load the old behaviour stands — a key with no
   * entry shows itself, so a missing translation is visible rather than blank.
   *
   * It is also why the Add button needed two clicks, which the QA round filed
   * separately. `common.add` is wider than "Add", so the button was painted
   * 141px wide and then shrank to 79px — and it is the last item in a
   * right-aligned row, so its left edge jumped 62px to the right. A cursor
   * resting on the left half of a button a person could plainly see was
   * clicking the header background by the time the button moved. Blank keeps
   * the placeholder narrower than the text that replaces it, so a control can
   * only ever grow, and growing never takes a pixel away from under a cursor.
   * Anything that restores the key here brings that back.
   */
  private static readonly KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

  private fallback(key: string): string {
    return !this.settled() && I18nService.KEY_SHAPE.test(key) ? '' : key;
  }

  private detectInitial(): Lang {
    return readStoredLang();
  }

  private applyDocumentAttrs(lang: Lang) {
    const html = this.document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }

  /**
   * Per-deploy cache key for the dictionaries.
   *
   * Angular copies `public/` verbatim, so `en.json` keeps the same URL forever
   * while its contents change every release. Any browser holding a cached copy
   * keeps serving the old strings, and a hard reload does not dislodge it —
   * the file is fetched by XHR after bootstrap, not as part of the navigation.
   *
   * The main bundle IS content-hashed, so its hash is a free token that moves
   * on a deploy. It is a nudge, not the guarantee: a build that changes only
   * translations can leave the bundle hash untouched. Correctness comes from
   * the `no-cache` header on these files in `.htaccess`; this just retires the
   * entries browsers cached back when they carried a one-hour lifetime.
   */
  private buildTag(): string {
    const src = this.document.querySelector<HTMLScriptElement>('script[src*="main-"]')?.src ?? '';
    return /main-([A-Za-z0-9_-]+)\.js/.exec(src)?.[1] ?? 'dev';
  }

  private load(lang: Lang) {
    this.http.get<Record<string, string>>(`assets/i18n/${lang}.json?v=${this.buildTag()}`).subscribe({
      next: d => { this.dict.set(d); this.settled.set(true); },
      error: () => { this.dict.set({}); this.settled.set(true); }
    });
  }
}
