import { Injectable, signal, computed, inject, DOCUMENT } from '@angular/core';
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
  return (navigator?.language ?? 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private http = inject(HttpClient);
  private document = inject(DOCUMENT);

  readonly lang = signal<Lang>(this.detectInitial());
  private readonly dict = signal<Record<string, string>>({});

  readonly isRtl = computed(() => this.lang() === 'ar');
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.isRtl() ? 'rtl' : 'ltr'));

  constructor() {
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
    const text = value === undefined || value === '' ? key : value;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] === undefined ? match : String(params[name])
    );
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
      next: d => this.dict.set(d),
      error: () => this.dict.set({})
    });
  }
}
