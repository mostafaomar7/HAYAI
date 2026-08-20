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

  private load(lang: Lang) {
    this.http.get<Record<string, string>>(`assets/i18n/${lang}.json`).subscribe({
      next: d => this.dict.set(d),
      error: () => this.dict.set({})
    });
  }
}
