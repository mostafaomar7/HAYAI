import { Injectable, signal, computed, inject, DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'hayai_lang';

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

  translate(key: string): string {
    const value = this.dict()[key];
    return value === undefined || value === '' ? key : value;
  }

  private detectInitial(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'ar') return stored;
    } catch {}
    const browser = (this.document.defaultView?.navigator?.language ?? 'en').toLowerCase();
    return browser.startsWith('ar') ? 'ar' : 'en';
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
