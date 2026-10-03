import { Routes } from '@angular/router';
import { websitePermissionGuard } from '../../../../core/guards/website-permission.guard';

/**
 * The Website CMS section, mounted at `/dashboard/website`.
 *
 * `data.permission` is the granular website permission the screen's main read
 * needs (see `website-cms-dashboard-api.md` §0.1); the guard sends an admin
 * without it to the overview rather than into a screen of 403s. `data.title`
 * is the navbar heading, reusing the sidebar's `menu.website.*` keys.
 *
 * Literal segments (`new`) come before `:id` so they are not parsed as ids.
 */
const r = (path: string, title: string, permission: string, load: () => Promise<any>, extra: Record<string, unknown> = {}) => ({
  path,
  canActivate: [websitePermissionGuard],
  data: { title, permission, ...extra },
  loadComponent: load
});

export const WEBSITE_ROUTES: Routes = [
  r('', 'menu.website.overview', 'cms.view',
    () => import('./overview/website-overview').then(m => m.WebsiteOverview)),

  // Pages and articles are one entity (`type: article`), one list and one editor.
  r('pages', 'menu.website.pages', 'cms.view',
    () => import('./pages/page-list').then(m => m.PageList), { pageKind: 'pages' }),
  r('pages/new', 'menu.website.pages', 'cms.create',
    () => import('./pages/page-editor').then(m => m.PageEditor), { pageKind: 'pages' }),
  r('pages/:id', 'menu.website.pages', 'cms.view',
    () => import('./pages/page-editor').then(m => m.PageEditor), { pageKind: 'pages' }),
  r('articles', 'menu.website.articles', 'cms.view',
    () => import('./pages/page-list').then(m => m.PageList), { pageKind: 'articles' }),
  r('articles/new', 'menu.website.articles', 'cms.create',
    () => import('./pages/page-editor').then(m => m.PageEditor), { pageKind: 'articles' }),
  r('articles/:id', 'menu.website.articles', 'cms.view',
    () => import('./pages/page-editor').then(m => m.PageEditor), { pageKind: 'articles' }),

  r('products', 'menu.website.products', 'products.view',
    () => import('./products/product-list').then(m => m.ProductList)),
  r('products/new', 'menu.website.products', 'products.create',
    () => import('./products/product-editor').then(m => m.ProductEditor)),
  r('products/:id', 'menu.website.products', 'products.view',
    () => import('./products/product-editor').then(m => m.ProductEditor)),
  r('categories', 'menu.website.categories', 'cms.view',
    () => import('./categories/categories').then(m => m.Categories)),

  r('purchases', 'menu.website.purchases', 'orders.view',
    () => import('./purchases/purchase-list').then(m => m.PurchaseList)),
  r('purchases/:id', 'menu.website.purchases', 'orders.view',
    () => import('./purchases/purchase-detail').then(m => m.PurchaseDetail)),
  r('leads', 'menu.website.leads', 'leads.view',
    () => import('./leads/lead-list').then(m => m.LeadList)),
  r('leads/:id', 'menu.website.leads', 'leads.view',
    () => import('./leads/lead-detail').then(m => m.LeadDetail)),
  r('forms', 'menu.website.forms', 'cms.view',
    () => import('./forms/form-list').then(m => m.FormList)),
  r('forms/new', 'menu.website.forms', 'cms.create',
    () => import('./forms/form-builder').then(m => m.FormBuilder)),
  r('forms/:id', 'menu.website.forms', 'cms.view',
    () => import('./forms/form-builder').then(m => m.FormBuilder)),

  r('ctas', 'menu.website.ctas', 'cms.view',
    () => import('./ctas/ctas').then(m => m.Ctas)),
  r('authors', 'menu.website.authors', 'cms.view',
    () => import('./authors/authors').then(m => m.Authors)),
  r('faqs', 'menu.website.faqs', 'cms.view',
    () => import('./faqs/faqs').then(m => m.Faqs)),
  r('media', 'menu.website.media', 'media.view',
    () => import('./media/media-library').then(m => m.MediaLibrary)),
  r('menus', 'menu.website.menus', 'cms.view',
    () => import('./menus/menus').then(m => m.Menus)),

  r('analytics', 'menu.website.analytics', 'analytics.view',
    () => import('./analytics/website-analytics').then(m => m.WebsiteAnalytics)),
  r('crawlers', 'menu.website.crawlers', 'seo.view',
    () => import('./crawlers/crawlers').then(m => m.Crawlers)),
  r('redirects', 'menu.website.redirects', 'redirects.view',
    () => import('./redirects/redirects').then(m => m.Redirects)),
  r('settings', 'menu.website.settings', 'settings.view',
    () => import('./settings/website-settings').then(m => m.WebsiteSettings)),
  r('audit', 'menu.website.audit', 'audit.view',
    () => import('./audit/website-audit').then(m => m.WebsiteAudit)),
  r('roles', 'menu.website.roles', 'roles.manage',
    () => import('./roles/website-roles').then(m => m.WebsiteRoles)),
];
