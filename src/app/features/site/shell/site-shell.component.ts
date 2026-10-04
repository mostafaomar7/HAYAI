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
import { SeoHeadService } from '../services/seo-head.service';
import { CtaButtonComponent } from '../ui/cta-button.component';
import { SiteFormComponent } from '../ui/site-form.component';
import { PurchaseFormComponent } from '../ui/purchase-form.component';
import { MenuItem } from '../models/site.models';
import { hrefOf, str } from '../site-utils';
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
  imports: [RouterOutlet, CtaButtonComponent, SiteFormComponent, PurchaseFormComponent],
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
  protected logo = computed(() => str(this.org().logo_url) || '/logo.png');
  protected headerMenu = computed(() => this.state.site()?.menus?.header ?? []);
  protected footerMenu = computed(() => this.state.site()?.menus?.footer ?? []);
  protected headerCta = computed(() => this.state.siteCtas('header')[0] ?? null);
  protected footerCtas = computed(() => this.state.siteCtas('footer'));
  protected stickyMobile = computed(() => this.state.ctas('sticky_mobile').slice(0, 2));
  protected stickyDesktop = computed(() => this.state.ctas('sticky_desktop').slice(0, 2));
  protected sameAs = computed(() => (this.org().same_as ?? []).filter(Boolean));
  protected whatsappHref = computed(() => {
    const n = str(this.org().whatsapp).replace(/[^\d]/g, '');
    return n ? `https://wa.me/${n}` : null;
  });

  /** The language switcher points at the hreflang alternate of THIS page
   *  (slugs differ per language), falling back to the other home page. */
  protected switchHref = computed(() => {
    const other = this.state.otherLocale();
    const alt = this.state.alternates().find(a => a.hreflang === other || a.locale === other);
    if (alt?.href) {
      try {
        const u = new URL(alt.href);
        return u.pathname + u.search;
      } catch {
        return alt.href;
      }
    }
    return `/${other}`;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(e => this.afterNavigation(e));

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
      this.analytics.track('page_view', { referrer: this.lastPath === null ? this.document.referrer || null : null });
    }
    this.lastPath = path;
  }
}
