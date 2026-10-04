import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, PagedResult } from '../api.service';
import { ApiPagination } from '../../models/api-response.model';
import {
  AnalyticsEvent, AnalyticsRange, AnalyticsSummary, AuditLogRow, AuthorInput, BlockDefinition,
  CampaignAnalyticsRow, CategoryInput, ContentVersion, CrawlerVisibility, CtaAnalyticsRow, CtaInput,
  FaqInput, FormInput, GeoMeta, ListParams, LlmsEntry, LlmsEntryInput, Locale, MediaUsage,
  MenuItemNode, PageAnalyticsRow, PageCreateInput, PageListParams, PageSection, PageTranslationInput,
  PageUpdateInput, PermissionCatalog, PreviewToken, ProductInput, ProductRelationsInput,
  RedirectInput, ResolvedUrl, RobotsRule, RobotsRuleInput, SeoAuditResult, SeoMeta, SitemapInfo,
  VersionDiff, WebsiteAdmin, WebsiteAuthor, WebsiteCategory, WebsiteCta, WebsiteEnums, WebsiteFaq,
  WebsiteForm, WebsiteLead, WebsiteMe, WebsiteMedia, WebsiteMenu, WebsiteOverview, WebsitePage,
  WebsitePageRow, WebsiteProduct, WebsitePurchase, WebsiteRedirect, WebsiteRole, WebsiteSetting,
  WebsiteSource
} from './website.models';

const BASE = '/admin/website';

/** A list whose `meta` also carries `counts` (leads / purchases status tabs). */
export interface CountedPage<T> extends PagedResult<T> {
  counts: Record<string, number>;
}

/** Pages and products share the versioning endpoints under their own root. */
export type VersionedEntity = 'pages' | 'products';

/**
 * Admin client for the Website CMS (`/api/v1/admin/website/*`).
 *
 * One method per endpoint in `website-cms-dashboard-api.md`, grouped in the
 * same order as that document so a section number there finds its calls here.
 * Every call returns the envelope's `data` (lists keep `meta.pagination`).
 * Errors are left to the caller: a 422 carries `errors` keyed by field path
 * (`sections.1.data.headline`) that the editors map back onto their inputs.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteApiService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // ── 0. conventions ──────────────────────────────────────────────

  me(): Observable<WebsiteMe> {
    return this.api.get<WebsiteMe>(`${BASE}/me`);
  }

  enums(): Observable<WebsiteEnums> {
    return this.api.get<WebsiteEnums>(`${BASE}/enums`);
  }

  overview(): Observable<WebsiteOverview> {
    return this.api.get<WebsiteOverview>(`${BASE}/overview`);
  }

  // ── 2. pages ────────────────────────────────────────────────────

  pages(params: PageListParams = {}): Observable<PagedResult<WebsitePageRow>> {
    return this.api.getPaged<WebsitePageRow>(`${BASE}/pages`, params);
  }

  page(id: number): Observable<WebsitePage> {
    return this.api.get<WebsitePage>(`${BASE}/pages/${id}`);
  }

  createPage(body: PageCreateInput): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages`, body);
  }

  updatePage(id: number, body: PageUpdateInput): Observable<WebsitePage> {
    return this.api.patch<WebsitePage>(`${BASE}/pages/${id}`, body);
  }

  savePageTranslation(id: number, locale: Locale, body: PageTranslationInput): Observable<WebsitePage> {
    return this.api.put<WebsitePage>(`${BASE}/pages/${id}/translations/${locale}`, body);
  }

  deletePageTranslation(id: number, locale: Locale): Observable<unknown> {
    return this.api.delete(`${BASE}/pages/${id}/translations/${locale}`);
  }

  // 2.6 blocks
  sections(pageId: number, locale: Locale): Observable<PageSection[]> {
    return this.api.get<PageSection[]>(`${BASE}/pages/${pageId}/translations/${locale}/sections`);
  }

  /** Replaces the whole list; array order is display order. */
  saveSections(pageId: number, locale: Locale, sections: PageSection[]): Observable<PageSection[]> {
    return this.api.put<PageSection[]>(`${BASE}/pages/${pageId}/translations/${locale}/sections`, { sections });
  }

  addSection(pageId: number, locale: Locale, section: PageSection & { position?: number }): Observable<PageSection> {
    return this.api.post<PageSection>(`${BASE}/pages/${pageId}/translations/${locale}/sections`, section);
  }

  reorderSections(pageId: number, locale: Locale, ids: number[]): Observable<PageSection[]> {
    return this.api.post<PageSection[]>(`${BASE}/pages/${pageId}/translations/${locale}/sections/reorder`, { ids });
  }

  updateSection(sectionId: number, body: Partial<PageSection>): Observable<PageSection> {
    return this.api.patch<PageSection>(`${BASE}/sections/${sectionId}`, body);
  }

  deleteSection(sectionId: number): Observable<unknown> {
    return this.api.delete(`${BASE}/sections/${sectionId}`);
  }

  // 2.7 SEO / GEO / relations
  seo(entity: VersionedEntity, id: number, locale: Locale): Observable<SeoMeta> {
    return this.api.get<SeoMeta>(`${BASE}/${entity}/${id}/seo/${locale}`);
  }

  saveSeo(entity: VersionedEntity, id: number, locale: Locale, body: SeoMeta): Observable<SeoMeta> {
    return this.api.put<SeoMeta>(`${BASE}/${entity}/${id}/seo/${locale}`, body);
  }

  /** Products have no GEO read endpoint; their GEO comes back on `GET /products/{id}`. */
  geo(id: number, locale: Locale): Observable<GeoMeta> {
    return this.api.get<GeoMeta>(`${BASE}/pages/${id}/geo/${locale}`);
  }

  saveGeo(entity: VersionedEntity, id: number, locale: Locale, body: GeoMeta): Observable<GeoMeta> {
    return this.api.put<GeoMeta>(`${BASE}/${entity}/${id}/geo/${locale}`, body);
  }

  savePageSources(id: number, sources: WebsiteSource[]): Observable<WebsitePage> {
    return this.api.put<WebsitePage>(`${BASE}/pages/${id}/sources`, { sources });
  }

  savePageFaqs(id: number, faqIds: number[]): Observable<WebsitePage> {
    return this.api.put<WebsitePage>(`${BASE}/pages/${id}/faqs`, { faq_ids: faqIds });
  }

  savePageCtas(id: number, ctas: { cta_id: number; placement: string; is_enabled?: boolean }[]): Observable<WebsitePage> {
    return this.api.put<WebsitePage>(`${BASE}/pages/${id}/ctas`, { ctas });
  }

  // 2.8 publishing
  publish(id: number, label?: string | null): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/publish`, label ? { label } : {});
  }

  unpublish(id: number): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/unpublish`);
  }

  /** Pass both nulls to cancel a schedule. */
  schedule(id: number, publishAt: string | null, unpublishAt: string | null): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/schedule`, { publish_at: publishAt, unpublish_at: unpublishAt });
  }

  archive(id: number): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/archive`);
  }

  // 2.9 delete / restore / duplicate
  deletePage(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/pages/${id}`);
  }

  restorePage(id: number): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/restore`);
  }

  duplicatePage(id: number): Observable<WebsitePage> {
    return this.api.post<WebsitePage>(`${BASE}/pages/${id}/duplicate`);
  }

  // 2.10 versions (pages and products share the shape)
  versions(entity: VersionedEntity, id: number): Observable<ContentVersion[]> {
    return this.api.get<ContentVersion[]>(`${BASE}/${entity}/${id}/versions`);
  }

  saveVersion(entity: VersionedEntity, id: number, label: string): Observable<ContentVersion> {
    return this.api.post<ContentVersion>(`${BASE}/${entity}/${id}/versions`, { label });
  }

  version(entity: VersionedEntity, id: number, version: number): Observable<ContentVersion> {
    return this.api.get<ContentVersion>(`${BASE}/${entity}/${id}/versions/${version}`);
  }

  compareVersions(entity: VersionedEntity, id: number, a: number, b: number | 'current'): Observable<VersionDiff> {
    return this.api.get<VersionDiff>(`${BASE}/${entity}/${id}/versions/${a}/compare/${b}`);
  }

  restoreVersion(entity: VersionedEntity, id: number, version: number): Observable<unknown> {
    return this.api.post(`${BASE}/${entity}/${id}/versions/${version}/restore`);
  }

  // 2.11 preview
  /** The public page payload (`is_preview: true`). Typed loosely: it is rendered, not edited. */
  preview(entity: VersionedEntity, id: number, locale: Locale, version?: number | null): Observable<any> {
    return this.api.get<any>(`${BASE}/${entity}/${id}/preview`, { locale, version: version ?? undefined });
  }

  previewToken(id: number, locale: Locale, version?: number | null): Observable<PreviewToken> {
    return this.api.post<PreviewToken>(`${BASE}/pages/${id}/preview-token`, { locale, version: version ?? undefined });
  }

  // 2.12 audit
  seoAudit(entity: VersionedEntity, id: number, locale?: Locale): Observable<SeoAuditResult[]> {
    return this.api.get<SeoAuditResult[]>(`${BASE}/${entity}/${id}/seo-audit`, { locale });
  }

  // ── 3. block catalogue ──────────────────────────────────────────

  blocks(): Observable<BlockDefinition[]> {
    return this.api.get<BlockDefinition[]>(`${BASE}/blocks`);
  }

  // ── 4. CTAs ─────────────────────────────────────────────────────

  ctas(params: ListParams = {}): Observable<PagedResult<WebsiteCta>> {
    return this.api.getPaged<WebsiteCta>(`${BASE}/ctas`, params);
  }

  cta(id: number): Observable<WebsiteCta> {
    return this.api.get<WebsiteCta>(`${BASE}/ctas/${id}`);
  }

  createCta(body: CtaInput): Observable<WebsiteCta> {
    return this.api.post<WebsiteCta>(`${BASE}/ctas`, body);
  }

  updateCta(id: number, body: CtaInput): Observable<WebsiteCta> {
    return this.api.patch<WebsiteCta>(`${BASE}/ctas/${id}`, body);
  }

  deleteCta(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/ctas/${id}`);
  }

  // ── 5. products & categories ────────────────────────────────────

  products(params: ListParams = {}): Observable<PagedResult<WebsiteProduct>> {
    return this.api.getPaged<WebsiteProduct>(`${BASE}/products`, params);
  }

  product(id: number): Observable<WebsiteProduct> {
    return this.api.get<WebsiteProduct>(`${BASE}/products/${id}`);
  }

  createProduct(body: ProductInput): Observable<WebsiteProduct> {
    return this.api.post<WebsiteProduct>(`${BASE}/products`, body);
  }

  updateProduct(id: number, body: ProductInput): Observable<WebsiteProduct> {
    return this.api.patch<WebsiteProduct>(`${BASE}/products/${id}`, body);
  }

  deleteProductTranslation(id: number, locale: Locale): Observable<unknown> {
    return this.api.delete(`${BASE}/products/${id}/translations/${locale}`);
  }

  deleteProduct(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/products/${id}`);
  }

  restoreProduct(id: number): Observable<WebsiteProduct> {
    return this.api.post<WebsiteProduct>(`${BASE}/products/${id}/restore`);
  }

  /** Send only what changes: sources / faq_ids / ctas each replace when present. */
  saveProductRelations(id: number, body: ProductRelationsInput): Observable<WebsiteProduct> {
    return this.api.put<WebsiteProduct>(`${BASE}/products/${id}/relations`, body);
  }

  categories(params: ListParams = {}): Observable<PagedResult<WebsiteCategory>> {
    return this.api.getPaged<WebsiteCategory>(`${BASE}/categories`, params);
  }

  createCategory(body: CategoryInput): Observable<WebsiteCategory> {
    return this.api.post<WebsiteCategory>(`${BASE}/categories`, body);
  }

  updateCategory(id: number, body: CategoryInput): Observable<WebsiteCategory> {
    return this.api.patch<WebsiteCategory>(`${BASE}/categories/${id}`, body);
  }

  deleteCategory(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/categories/${id}`);
  }

  // ── 6. purchases ────────────────────────────────────────────────

  purchases(params: ListParams = {}): Observable<CountedPage<WebsitePurchase>> {
    return this.counted<WebsitePurchase>(`${BASE}/purchases`, params);
  }

  purchase(id: number): Observable<WebsitePurchase> {
    return this.api.get<WebsitePurchase>(`${BASE}/purchases/${id}`);
  }

  setPurchaseStatus(id: number, status: string, reason?: string | null, metadata?: Record<string, unknown> | null): Observable<WebsitePurchase> {
    return this.api.post<WebsitePurchase>(`${BASE}/purchases/${id}/status`, {
      status,
      reason: reason || undefined,
      metadata: metadata ?? undefined
    });
  }

  updatePurchase(id: number, body: { assigned_to?: number | null; internal_notes?: string | null }): Observable<WebsitePurchase> {
    return this.api.patch<WebsitePurchase>(`${BASE}/purchases/${id}`, body);
  }

  /** Manual (phone / e-mail) order: the public body plus `consent: true`. */
  createPurchase(body: Record<string, unknown>): Observable<WebsitePurchase> {
    return this.api.post<WebsitePurchase>(`${BASE}/purchases`, body);
  }

  // ── 7. leads ────────────────────────────────────────────────────

  leads(params: ListParams = {}): Observable<CountedPage<WebsiteLead>> {
    return this.counted<WebsiteLead>(`${BASE}/leads`, params);
  }

  lead(id: number): Observable<WebsiteLead> {
    return this.api.get<WebsiteLead>(`${BASE}/leads/${id}`);
  }

  updateLead(id: number, body: { status?: string; reason?: string | null; assigned_to?: number | null; internal_notes?: string | null }): Observable<WebsiteLead> {
    return this.api.patch<WebsiteLead>(`${BASE}/leads/${id}`, body);
  }

  deleteLead(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/leads/${id}`);
  }

  leadAttachment(id: number, index: number): Observable<HttpResponse<Blob>> {
    return this.download(`${BASE}/leads/${id}/attachments/${index}`);
  }

  exportLeads(params: ListParams = {}): Observable<HttpResponse<Blob>> {
    return this.download(`${BASE}/leads/export`, params);
  }

  // ── 8. forms ────────────────────────────────────────────────────

  forms(params: ListParams = {}): Observable<PagedResult<WebsiteForm>> {
    return this.api.getPaged<WebsiteForm>(`${BASE}/forms`, params);
  }

  form(id: number): Observable<WebsiteForm> {
    return this.api.get<WebsiteForm>(`${BASE}/forms/${id}`);
  }

  createForm(body: FormInput): Observable<WebsiteForm> {
    return this.api.post<WebsiteForm>(`${BASE}/forms`, body);
  }

  /** Sending `fields` replaces them all. */
  updateForm(id: number, body: FormInput): Observable<WebsiteForm> {
    return this.api.patch<WebsiteForm>(`${BASE}/forms/${id}`, body);
  }

  deleteForm(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/forms/${id}`);
  }

  // ── 9. authors ──────────────────────────────────────────────────

  authors(params: ListParams = {}): Observable<PagedResult<WebsiteAuthor>> {
    return this.api.getPaged<WebsiteAuthor>(`${BASE}/authors`, params);
  }

  author(id: number): Observable<WebsiteAuthor> {
    return this.api.get<WebsiteAuthor>(`${BASE}/authors/${id}`);
  }

  createAuthor(body: AuthorInput): Observable<WebsiteAuthor> {
    return this.api.post<WebsiteAuthor>(`${BASE}/authors`, body);
  }

  updateAuthor(id: number, body: AuthorInput): Observable<WebsiteAuthor> {
    return this.api.patch<WebsiteAuthor>(`${BASE}/authors/${id}`, body);
  }

  deleteAuthor(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/authors/${id}`);
  }

  // ── 10. FAQs ────────────────────────────────────────────────────

  faqs(params: ListParams = {}): Observable<PagedResult<WebsiteFaq>> {
    return this.api.getPaged<WebsiteFaq>(`${BASE}/faqs`, params);
  }

  createFaq(body: FaqInput): Observable<WebsiteFaq> {
    return this.api.post<WebsiteFaq>(`${BASE}/faqs`, body);
  }

  updateFaq(id: number, body: FaqInput): Observable<WebsiteFaq> {
    return this.api.patch<WebsiteFaq>(`${BASE}/faqs/${id}`, body);
  }

  deleteFaq(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/faqs/${id}`);
  }

  // ── 11. media ───────────────────────────────────────────────────

  media(params: ListParams = {}): Observable<PagedResult<WebsiteMedia>> {
    return this.api.getPaged<WebsiteMedia>(`${BASE}/media`, params);
  }

  mediaItem(id: number): Observable<WebsiteMedia> {
    return this.api.get<WebsiteMedia>(`${BASE}/media/${id}`);
  }

  /** `form` carries `file` plus optional alt_en/alt_ar/caption_en/caption_ar/focal_x/focal_y. */
  uploadMedia(form: FormData): Observable<WebsiteMedia> {
    return this.api.postMultipart<WebsiteMedia>(`${BASE}/media`, form);
  }

  updateMedia(id: number, body: Partial<Pick<WebsiteMedia, 'alt_en' | 'alt_ar' | 'caption_en' | 'caption_ar' | 'focal_x' | 'focal_y'>>): Observable<WebsiteMedia> {
    return this.api.patch<WebsiteMedia>(`${BASE}/media/${id}`, body);
  }

  mediaUsage(id: number): Observable<MediaUsage[]> {
    return this.api.get<MediaUsage[]>(`${BASE}/media/${id}/usage`);
  }

  deleteMedia(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/media/${id}`);
  }

  // ── 12. menus ───────────────────────────────────────────────────

  menus(): Observable<WebsiteMenu[]> {
    return this.api.get<WebsiteMenu[]>(`${BASE}/menus`);
  }

  menu(key: string): Observable<WebsiteMenu> {
    return this.api.get<WebsiteMenu>(`${BASE}/menus/${encodeURIComponent(key)}`);
  }

  saveMenuItems(key: string, locale: Locale, items: MenuItemNode[]): Observable<WebsiteMenu> {
    return this.api.put<WebsiteMenu>(`${BASE}/menus/${encodeURIComponent(key)}/items`, { locale, items });
  }

  saveMenuCtas(key: string, ctas: { cta_id: number; placement: string; is_enabled?: boolean }[]): Observable<WebsiteMenu> {
    return this.api.put<WebsiteMenu>(`${BASE}/menus/${encodeURIComponent(key)}/ctas`, { ctas });
  }

  // ── 13. settings / redirects / robots / llms / sitemap ──────────

  settings(): Observable<WebsiteSetting[]> {
    return this.api.get<WebsiteSetting[]>(`${BASE}/settings`);
  }

  /** Flat keys: `{ "organization.phone": "…", "directory.doctors_public": false }`. */
  updateSettings(body: Record<string, unknown>): Observable<WebsiteSetting[]> {
    return this.api.patch<WebsiteSetting[]>(`${BASE}/settings`, body);
  }

  flushCache(): Observable<unknown> {
    return this.api.post(`${BASE}/cache/flush`);
  }

  redirects(params: ListParams = {}): Observable<PagedResult<WebsiteRedirect>> {
    return this.api.getPaged<WebsiteRedirect>(`${BASE}/redirects`, params);
  }

  testRedirect(path: string): Observable<{ location: string; status_code: number } | null> {
    return this.api.get<{ location: string; status_code: number } | null>(`${BASE}/redirects/test`, { path });
  }

  createRedirect(body: RedirectInput): Observable<WebsiteRedirect> {
    return this.api.post<WebsiteRedirect>(`${BASE}/redirects`, body);
  }

  updateRedirect(id: number, body: RedirectInput): Observable<WebsiteRedirect> {
    return this.api.patch<WebsiteRedirect>(`${BASE}/redirects/${id}`, body);
  }

  deleteRedirect(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/redirects/${id}`);
  }

  robotsRules(): Observable<RobotsRule[]> {
    return this.api.get<RobotsRule[]>(`${BASE}/robots/rules`);
  }

  createRobotsRule(body: RobotsRuleInput): Observable<RobotsRule> {
    return this.api.post<RobotsRule>(`${BASE}/robots/rules`, body);
  }

  updateRobotsRule(id: number, body: RobotsRuleInput): Observable<RobotsRule> {
    return this.api.patch<RobotsRule>(`${BASE}/robots/rules/${id}`, body);
  }

  deleteRobotsRule(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/robots/rules/${id}`);
  }

  robotsPreview(): Observable<{ content: string; private_paths: string[] }> {
    return this.api.get<{ content: string; private_paths: string[] }>(`${BASE}/robots/preview`);
  }

  llmsEntries(): Observable<LlmsEntry[]> {
    return this.api.get<LlmsEntry[]>(`${BASE}/llms/entries`);
  }

  createLlmsEntry(body: LlmsEntryInput): Observable<LlmsEntry> {
    return this.api.post<LlmsEntry>(`${BASE}/llms/entries`, body);
  }

  updateLlmsEntry(id: number, body: LlmsEntryInput): Observable<LlmsEntry> {
    return this.api.patch<LlmsEntry>(`${BASE}/llms/entries/${id}`, body);
  }

  deleteLlmsEntry(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/llms/entries/${id}`);
  }

  llmsPreview(): Observable<{ content: string; sections: unknown; excluded: { id: number; title: string; url: string; reason: string }[] }> {
    return this.api.get(`${BASE}/llms/preview`);
  }

  sitemap(): Observable<SitemapInfo> {
    return this.api.get<SitemapInfo>(`${BASE}/sitemap`);
  }

  resolveUrl(url: string): Observable<ResolvedUrl> {
    return this.api.get<ResolvedUrl>(`${BASE}/seo/resolve-url`, { url });
  }

  crawlers(days = 14): Observable<CrawlerVisibility> {
    return this.api.get<CrawlerVisibility>(`${BASE}/crawlers`, { days });
  }

  // ── 14. analytics ───────────────────────────────────────────────

  analyticsSummary(range: AnalyticsRange = {}): Observable<AnalyticsSummary> {
    return this.api.get<AnalyticsSummary>(`${BASE}/analytics/summary`, range);
  }

  analyticsCtas(range: AnalyticsRange = {}): Observable<CtaAnalyticsRow[]> {
    return this.api.get<CtaAnalyticsRow[]>(`${BASE}/analytics/ctas`, range);
  }

  analyticsPages(range: AnalyticsRange = {}): Observable<PageAnalyticsRow[]> {
    return this.api.get<PageAnalyticsRow[]>(`${BASE}/analytics/pages`, range);
  }

  analyticsCampaigns(range: AnalyticsRange = {}): Observable<CampaignAnalyticsRow[]> {
    return this.api.get<CampaignAnalyticsRow[]>(`${BASE}/analytics/campaigns`, range);
  }

  analyticsEvents(params: ListParams = {}): Observable<PagedResult<AnalyticsEvent>> {
    return this.api.getPaged<AnalyticsEvent>(`${BASE}/analytics/events`, params);
  }

  // ── 15. audit ───────────────────────────────────────────────────

  auditLogs(params: ListParams = {}): Observable<PagedResult<AuditLogRow>> {
    return this.api.getPaged<AuditLogRow>(`${BASE}/audit-logs`, params);
  }

  // ── 16. roles & admins ──────────────────────────────────────────

  permissions(): Observable<PermissionCatalog> {
    return this.api.get<PermissionCatalog>(`${BASE}/permissions`);
  }

  roles(): Observable<WebsiteRole[]> {
    return this.api.get<WebsiteRole[]>(`${BASE}/roles`);
  }

  createRole(body: { name: string; permissions: string[] }): Observable<WebsiteRole> {
    return this.api.post<WebsiteRole>(`${BASE}/roles`, body);
  }

  updateRole(id: number, body: { name?: string; permissions?: string[] }): Observable<WebsiteRole> {
    return this.api.patch<WebsiteRole>(`${BASE}/roles/${id}`, body);
  }

  deleteRole(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/roles/${id}`);
  }

  admins(): Observable<WebsiteAdmin[]> {
    return this.api.get<WebsiteAdmin[]>(`${BASE}/admins`);
  }

  setAdminRoles(userId: number, roles: string[]): Observable<WebsiteAdmin> {
    return this.api.put<WebsiteAdmin>(`${BASE}/admins/${userId}/roles`, { roles });
  }

  // ── helpers ─────────────────────────────────────────────────────

  private counted<T>(path: string, params: ListParams): Observable<CountedPage<T>> {
    return this.api
      .getWithMeta<T[], { pagination?: ApiPagination; counts?: Record<string, number> }>(path, params)
      .pipe(
        map(({ data, meta }) => {
          const items = data ?? [];
          return {
            items,
            counts: meta?.counts ?? {},
            pagination: meta?.pagination ?? {
              current_page: 1, per_page: items.length, total: items.length,
              last_page: 1, from: items.length ? 1 : 0, to: items.length
            }
          };
        })
      );
  }

  /** Authenticated file download (the interceptor adds the bearer token). */
  private download(path: string, params?: ListParams): Observable<HttpResponse<Blob>> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    }
    return this.http.get(`${this.api.baseUrl}${path}`, { params: p, responseType: 'blob', observe: 'response' });
  }
}

/**
 * Saves a downloaded blob under the server's file name when it sent one
 * (`Content-Disposition`), falling back to `fallbackName`.
 */
export function saveDownload(res: HttpResponse<Blob>, fallbackName: string): void {
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(res.body as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Flattens a 422 body into `{ "field.path": "first message" }` so editors can
 * show the message under the matching input. Unknown keys still surface in
 * the form-level error list.
 */
export function fieldErrors(err: any): Record<string, string> {
  const out: Record<string, string> = {};
  const errors = err?.error?.errors as Record<string, string[] | string> | undefined;
  if (!errors) return out;
  for (const [k, v] of Object.entries(errors)) {
    out[k] = Array.isArray(v) ? v[0] : String(v);
  }
  return out;
}

/** The backend's own message for a failed call, or `fallback` (an i18n key). */
export function errorMessage(err: any, fallback = 'common.error'): string {
  return err?.error?.message || fallback;
}
