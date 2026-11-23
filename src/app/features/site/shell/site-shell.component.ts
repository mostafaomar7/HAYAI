import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SiteStateService } from '../services/site-state.service';
import { SiteAnalyticsService } from '../services/site-analytics.service';
import { TagLayerService } from '../services/tag-layer.service';
import { WhatsappRefService } from '../services/whatsapp-ref.service';
import { StoreLinksService } from '../services/store-links.service';
import { SeoHeadService } from '../services/seo-head.service';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { SiteFormComponent } from '../ui/site-form.component';
import { PurchaseFormComponent } from '../ui/purchase-form.component';
import { StoreBadgesComponent } from '../ui/store-badges.component';
import { MenuItem } from '../models/site.models';
import { hrefOf, str } from '../site-utils';

/**
 * The emergency text with every occurrence of each hotline number turned
 * into its `tel:` link (a number inside a longer number is left alone).
 */
export function linkNumbers(
  text: string,
  numbers: { number: string; href: string }[] | null | undefined
): { text: string; href: string | null }[] {
  const nums = (numbers ?? []).filter(n => n?.number && n?.href);
  if (!text) return [];
  if (!nums.length) return [{ text, href: null }];
  const esc = nums.map(n => n.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\d٠-٩])(${esc.join('|')})(?![\\d٠-٩])`, 'g');
  const out: { text: string; href: string | null }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), href: null });
    out.push({ text: m[0], href: nums.find(n => n.number === m[0])?.href ?? null });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), href: null });
  return out;
}
import { withAttribution } from '../tracking-params';
import { isPublicSitePath } from '../site-paths';

/**
 * Public website chrome: header (menus, language switcher, primary CTA),
 * footer (organisation, contact, social profiles, privacy), sitewide sticky
 * CTAs, and the dialog that hosts CTA-opened forms and purchase requests.
 *
 * Styles: this component carries the site's whole design system with
 * `ViewEncapsulation.None`, scoped under `.site`. One stylesheet, inlined as
 * critical CSS by the SSR build, using logical properties only (`inline-start`,
 * `padding-inline`, …) so Arabic mirrors from the same rules via `dir="rtl"`.
 */
@Component({
  selector: 'site-shell',
  imports: [RouterOutlet, CtaButtonComponent, SiteFormComponent, PurchaseFormComponent, StoreBadgesComponent],
  templateUrl: './site-shell.component.html',
  styleUrl: './site-shell.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'interceptLinks($event)',
    '(document:keydown.escape)': 'closeModal()'
  }
})
export class SiteShellComponent implements OnDestroy {
  protected state = inject(SiteStateService);
  private analytics = inject(SiteAnalyticsService);
  private tags = inject(TagLayerService);
  private seo = inject(SeoHeadService);
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();
  private lastPath: string | null = null;
  private returnFocus: HTMLElement | null = null;

  protected org = computed(() => this.state.site()?.organization ?? {});
  protected orgName = computed(() => str(this.org().name) || 'HAYAI');
  protected legalName = computed(() => str(this.org().legal_name, this.org().name) || 'HAYAI');
  protected headerMenu = computed(() => this.state.site()?.menus?.header ?? []);
  protected footerMenu = computed(() => this.state.site()?.menus?.footer ?? []);
  protected footerColumns = computed(() => this.footerMenu().filter(i => i.children?.length));
  protected footerLinks = computed(() => this.footerMenu().filter(i => !i.children?.length));

  protected emergency = computed(() => {
    const eb = this.state.site()?.emergency_bar;
    return eb?.enabled && (str(eb.text) || str(eb.short_text)) ? eb : null;
  });
  protected ebLong = computed(() => linkNumbers(str(this.emergency()?.text, this.emergency()?.short_text), this.emergency()?.numbers));
  protected ebShort = computed(() => linkNumbers(str(this.emergency()?.short_text, this.emergency()?.text), this.emergency()?.numbers));

  /** The path on screen, for the menu's active item. */
  private currentPath = signal(this.router.url.split(/[?#]/)[0]);
  protected headerCta = computed(() => this.state.siteCtas('header')[0] ?? null);
  protected footerCtas = computed(() => this.state.siteCtas('footer'));
  protected stickyMobile = computed(() => this.state.ctas('sticky_mobile').slice(0, 2));
  protected stickyDesktop = computed(() => this.state.ctas('sticky_desktop').slice(0, 2));
  protected sameAs = computed(() => (this.org().same_as ?? []).filter(Boolean));
  protected whatsappHref = computed(() => {
    const n = str(this.org().whatsapp).replace(/[^\d]/g, '');
    return n ? `https://wa.me/${n}` : null;
  });

  /**
   * This visit's query string, kept in step with navigation. Read from the
   * router rather than `location`, so it is the same on the server render
   * and in the browser.
   */
  private currentSearch = signal(this.router.url.split('?')[1] ?? '');

  /** The language switcher points at the hreflang alternate of THIS page
   *  (slugs differ per language), falling back to the other home page.
   *
   *  The alternate comes from the API and carries only what identifies the
   *  page, so this visit's `gclid` / `utm_*` have to be carried over by hand.
   *  Without that, switching language strips the ad click id from the URL —
   *  and a visitor who has not yet answered the consent banner has nothing
   *  storing it, so the click becomes unattributable. */
  protected switchHref = computed(() => {
    const other = this.state.otherLocale();
    const search = this.currentSearch();
    const alt = this.state.alternates().find(a => a.hreflang === other || a.locale === other);
    if (alt?.href) {
      try {
        const u = new URL(alt.href);
        return withAttribution(u.pathname + u.search, search);
      } catch {
        return withAttribution(alt.href, search);
      }
    }
    return withAttribution(`/${other}`, search);
  });

  constructor() {
    // A reference code on every WhatsApp chat started from the site.
    inject(WhatsappRefService).install();
    // The visit's campaign on every Google Play / App Store button.
    inject(StoreLinksService).install();
    this.preloadFonts();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(e => {
        this.currentSearch.set(e.urlAfterRedirects.split('?')[1] ?? '');
        this.currentPath.set(e.urlAfterRedirects.split(/[?#]/)[0]);
        this.afterNavigation(e);
      });

    // Body scroll lock + focus handling while the dialog is open.
    effect(() => {
      const open = !!this.state.modal();
      if (!this.isBrowser) return;
      this.document.body.classList.toggle('site-modal-open', open);
      if (open) {
        this.returnFocus = this.document.activeElement as HTMLElement | null;
        setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.modal')?.focus());
      } else if (this.returnFocus) {
        this.returnFocus.focus?.();
        this.returnFocus = null;
      }
    });
  }

  ngOnDestroy(): void {
    // Leaving the public site for the dashboard: drop the page's SEO tags.
    this.seo.clear();
    if (this.isBrowser) this.document.body.classList.remove('site-modal-open');
  }

  protected href(item: MenuItem): string {
    return hrefOf(item);
  }

  /** A profile link's platform name instead of its raw URL. */
  protected socialName(url: string): string {
    const known: [RegExp, string][] = [
      [/instagram\.com/i, 'Instagram'],
      [/facebook\.com/i, 'Facebook'],
      [/linkedin\.com/i, 'LinkedIn'],
      [/play\.google\.com/i, 'Google Play'],
      [/apps\.apple\.com/i, 'App Store'],
      [/(x|twitter)\.com/i, 'X'],
      [/youtube\.com/i, 'YouTube'],
      [/tiktok\.com/i, 'TikTok'],
      [/google\.[a-z.]+\/(search|maps)/i, 'Google']
    ];
    for (const [re, name] of known) if (re.test(url)) return name;
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }

  /** The item for this page or a page under it (never the bare home link). */
  protected isActive(item: MenuItem): boolean {
    const norm = (p: string) => {
      try {
        return decodeURI(p).replace(/\/+$/, '');
      } catch {
        return p.replace(/\/+$/, '');
      }
    };
    const target = norm(hrefOf(item).split(/[?#]/)[0]);
    const here = norm(this.currentPath());
    if (!target.startsWith('/') || target.split('/').filter(Boolean).length < 2) return false;
    return here === target || here.startsWith(target + '/');
  }

  /** Above-the-fold fonts for this language, preloaded from the server HTML. */
  private preloadFonts(): void {
    const files =
      this.state.locale() === 'ar'
        ? ['/fonts/plex-arabic-700.woff2', '/fonts/plex-arabic-400.woff2']
        : ['/fonts/instrument-serif-italic-latin.woff2', '/fonts/carlito-400-latin.woff2'];
    const head = this.document.head;
    head.querySelectorAll('link[data-site-font]').forEach(l => l.remove());
    for (const href of files) {
      const l = this.document.createElement('link');
      l.setAttribute('rel', 'preload');
      l.setAttribute('as', 'font');
      l.setAttribute('type', 'font/woff2');
      l.setAttribute('href', href);
      l.setAttribute('crossorigin', '');
      l.setAttribute('data-site-font', '');
      head.appendChild(l);
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  protected closeModal(): void {
    if (this.state.modal()) this.state.modal.set(null);
  }

  protected modalTitle(): string {
    const m = this.state.modal();
    if (!m) return '';
    if (m.kind === 'purchase') return this.state.t('purchaseTitle');
    return str(this.state.form(m.formKey)?.name) || this.state.t('contactUs');
  }

  /**
   * Client-side routing for plain `<a href>` links — menus, CMS rich text,
   * CTAs. Links stay real anchors in the HTML (crawlable, work without JS);
   * once hydrated, internal ones navigate without a full page load.
   */
  protected interceptLinks(event: MouseEvent): void {
    if (!this.isBrowser || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = (event.target as HTMLElement | null)?.closest?.('a');
    if (!a || !a.getAttribute('href') || a.hasAttribute('download')) return;
    if (a.target && a.target !== '_self') return;
    let url: URL;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return;
    }
    const siteHost = (() => {
      try {
        return new URL(this.state.site()?.base_url ?? '').host;
      } catch {
        return '';
      }
    })();
    if (url.host !== location.host && url.host !== siteHost) return;
    if (!isPublicSitePath(url.pathname)) return; // e.g. /dashboard: full load
    // Same-page anchors are left to the browser.
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    event.preventDefault();
    this.menuOpen.set(false);
    this.router.navigateByUrl(url.pathname + url.search + url.hash);
  }

  private afterNavigation(e: NavigationEnd): void {
    this.state.modal.set(null);
    this.menuOpen.set(false);
    if (!this.isBrowser) return;
    const [path] = e.urlAfterRedirects.split('#');
    const hasFragment = e.urlAfterRedirects.includes('#');
    if (this.lastPath !== null && this.lastPath !== path && !hasFragment) window.scrollTo(0, 0);
    if (this.lastPath !== path) {
      this.analytics.captureLanding();
      // Not on the first path: the server already pushed that one, before the
      // container loaded. Pushing it again would count the landing twice.
      if (this.lastPath !== null) this.tags.virtualPageView(path);
      this.analytics.track('page_view', { referrer: this.lastPath === null ? this.document.referrer || null : null });
    }
    this.lastPath = path;
  }
}
