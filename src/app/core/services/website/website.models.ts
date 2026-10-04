/**
 * Types for the Website CMS admin API (`/admin/website/*`).
 *
 * Mirrors `website-cms-dashboard-api.md` (as built 2026-10-02). Where the
 * contract shows a free-form object (block data, settings, schema, diffs) the
 * type stays loose on purpose: the block catalogue is served by `GET /blocks`
 * so a new block type is a backend change only, and hardcoding its shape here
 * would make the dashboard the thing that has to be redeployed.
 */

export type Locale = 'en' | 'ar';

/**
 * The named properties of T without its `[extra: string]: unknown` index
 * signature. `Omit<>` over an indexed interface keeps only the index, which
 * would turn every `*Input` type below into `Record<string, unknown>`.
 */
type Known<T> = { [K in keyof T as string extends K ? never : K]: T[K] };
export const LOCALES: Locale[] = ['en', 'ar'];

/** Per-language values keyed by locale, e.g. `{ en: {...}, ar: {...} }`. */
export type ByLocale<T> = Partial<Record<Locale, T>>;

// ───────────────────────────── permissions ─────────────────────────────

export type WebsitePermission =
  | 'cms.view' | 'cms.create' | 'cms.update' | 'cms.delete' | 'cms.publish'
  | 'seo.view' | 'seo.update'
  | 'products.view' | 'products.create' | 'products.update' | 'products.delete'
  | 'orders.view' | 'orders.create' | 'orders.update'
  | 'leads.view' | 'leads.update' | 'leads.delete'
  | 'media.view' | 'media.upload' | 'media.delete'
  | 'redirects.view' | 'redirects.create' | 'redirects.update' | 'redirects.delete'
  | 'analytics.view'
  | 'settings.view' | 'settings.update'
  | 'audit.view'
  | 'roles.manage';

export interface WebsiteMe {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: WebsitePermission[];
}

// ───────────────────────────── enums ─────────────────────────────

export interface LocaleInfo {
  code: Locale;
  name: string;
  native: string;
  dir: 'ltr' | 'rtl';
  hreflang: string;
  is_default: boolean;
}

/** A status with the moves allowed out of it (leads / purchases). */
export interface StatusFlow {
  value: string;
  next: string[];
  requires_reason?: boolean;
}

export interface WebsiteEnums {
  locales: LocaleInfo[];
  page_types: string[];
  content_statuses: string[];
  product_statuses: string[];
  pricing_types: string[];
  availability: string[];
  billing_periods: string[];
  cta_types: string[];
  cta_placements: string[];
  form_types: string[];
  form_field_types: string[];
  form_field_maps_to: string[];
  lead_statuses: StatusFlow[];
  purchase_statuses: StatusFlow[];
  media_kinds: string[];
  block_types: string[];
  analytics_events: string[];
  paths: Record<string, string>;
  reserved_prefixes: string[];
  [extra: string]: unknown;
}

export interface WebsiteOverview {
  website_url: string;
  pages: Record<string, number>;
  scheduled: { id: number; title: string; publish_at: string }[];
  products: Record<string, number>;
  leads: Record<string, number>;
  leads_new_7d: number;
  purchases: Record<string, number>;
  purchases_open: number;
}

// ───────────────────────────── media ─────────────────────────────

export interface MediaVariant {
  width: number;
  height: number;
  url: string;
  mime_type: string;
}

export interface WebsiteMedia {
  id: number;
  kind: 'image' | 'document' | 'video';
  url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  focal_point?: { x: number; y: number } | null;
  variants?: MediaVariant[];
  srcset?: string | null;
  filename?: string;
  original_name?: string;
  extension?: string;
  size?: number;
  alt_en?: string | null;
  alt_ar?: string | null;
  caption_en?: string | null;
  caption_ar?: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  variants_status?: 'pending' | 'ready' | 'failed';
  uploaded_by?: number | null;
  created_at?: string;
}

export interface MediaUsage {
  type: string;
  id: number;
  [extra: string]: unknown;
}

// ───────────────────────────── pages ─────────────────────────────

export interface PageTranslation {
  locale: Locale;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  slug: string;
  path?: string;
  url?: string;
  is_enabled?: boolean;
  published_path?: string | null;
  live_url?: string | null;
  content_updated_at?: string | null;
  body?: string | null;
  tags?: string[];
  sections?: PageSection[];
  seo?: SeoMeta | null;
  geo?: GeoMeta | null;
}

export interface SectionSettings {
  hide_on?: ('mobile' | 'desktop')[];
  theme?: 'default' | 'light' | 'dark' | 'brand' | 'muted';
  spacing?: 'none' | 'compact' | 'normal' | 'spacious';
}

export interface PageSection {
  id?: number;
  type: string;
  anchor?: string | null;
  data: Record<string, any>;
  settings?: SectionSettings | null;
  sort_order?: number;
  is_enabled?: boolean;
}

export interface WebsitePageRow {
  id: number;
  type: 'home' | 'page' | 'landing' | 'article';
  template: string;
  status: 'draft' | 'scheduled' | 'published' | 'unpublished' | 'archived';
  status_label?: string;
  is_live: boolean;
  parent_id: number | null;
  author_id: number | null;
  category_id: number | null;
  featured_media_id: number | null;
  is_featured: boolean;
  sort_order: number;
  settings: Record<string, any> | null;
  publish_at: string | null;
  unpublish_at: string | null;
  first_published_at: string | null;
  last_published_at: string | null;
  published_version_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  translations: PageTranslation[];
}

export interface WebsitePage extends WebsitePageRow {
  author?: WebsiteAuthor | null;
  category?: WebsiteCategory | null;
  featured_media?: WebsiteMedia | null;
  sources?: WebsiteSource[];
  faqs?: WebsiteFaq[];
  ctas?: AttachedCta[];
  has_unpublished_changes?: boolean;
  /** `{}` when publishable; otherwise field path → messages. */
  publish_errors?: Record<string, string[]>;
  published_version?: unknown;
  live_urls?: ByLocale<string>;
}

export interface PageTranslationInput {
  title: string;
  slug?: string | null;
  subtitle?: string | null;
  excerpt?: string | null;
  body?: string | null;
  tags?: string[];
  is_enabled?: boolean;
}

export interface PageCreateInput {
  type: WebsitePageRow['type'];
  template?: string;
  parent_id?: number | null;
  author_id?: number | null;
  category_id?: number | null;
  featured_media_id?: number | null;
  is_featured?: boolean;
  sort_order?: number;
  settings?: Record<string, any> | null;
  translations: ByLocale<PageTranslationInput>;
}

export type PageUpdateInput = Partial<Omit<PageCreateInput, 'translations'>>;

export interface PageListParams {
  page?: number;
  per_page?: number;
  type?: string;
  status?: string;
  locale?: string;
  parent_id?: number;
  author_id?: number;
  category_id?: number;
  q?: string;
  trashed?: 'with' | 'only';
  sort?: 'updated' | 'created' | 'published' | 'sort_order';
}

// ───────────────────────────── SEO / GEO ─────────────────────────────

export interface SeoMeta {
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  robots_index?: boolean;
  robots_follow?: boolean;
  robots_extra?: string | null;
  focus_topic?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_media_id?: number | null;
  og_type?: string | null;
  twitter_card?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image_media_id?: number | null;
  custom_schema?: Record<string, any> | Record<string, any>[] | null;
}

export interface GeoKeyFact {
  label: string;
  value: string;
  source_url?: string | null;
}

export interface GeoEntity {
  type?: string | null;
  name?: string | null;
  description?: string | null;
  same_as?: string[];
}

export interface GeoMeta {
  direct_answer_question?: string | null;
  direct_answer?: string | null;
  key_facts?: GeoKeyFact[];
  entity?: GeoEntity | null;
  last_verified_at?: string | null;
}

export interface WebsiteSource {
  id?: number;
  locale: Locale | null;
  title: string;
  url: string;
  organization?: string | null;
  published_on?: string | null;
  verified_on?: string | null;
}

export interface AttachedCta {
  cta_id: number;
  placement: string;
  is_enabled?: boolean;
  cta?: WebsiteCta;
  [extra: string]: unknown;
}

export interface SeoAuditCheck {
  key: string;
  level: 'error' | 'warning';
  passed: boolean;
  message: string;
}

export interface SeoAuditResult {
  locale: Locale;
  score: number;
  checks: SeoAuditCheck[];
}

// ───────────────────────────── versions / preview ─────────────────────────────

export interface ContentVersion {
  id: number;
  version: number;
  event: 'saved' | 'published' | 'scheduled' | 'restored' | string;
  label: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
  is_published: boolean;
  snapshot?: unknown;
}

export interface VersionDiff {
  from: number | string;
  to: number | string;
  diff: {
    added: Record<string, unknown>;
    removed: Record<string, unknown>;
    changed: Record<string, { from: unknown; to: unknown }>;
  };
}

export interface PreviewToken {
  token: string;
  expires_at: string;
  api_endpoint: string;
  preview_url: string;
}

// ───────────────────────────── blocks ─────────────────────────────

export interface BlockField {
  key: string;
  type: string;
  required?: boolean;
  max?: number;
  min?: number;
  options?: string[];
  item_fields?: BlockField[];
  label?: string;
  help?: string;
  default?: unknown;
  [extra: string]: unknown;
}

export interface BlockDefinition {
  type: string;
  label: string;
  category: string;
  description: string;
  fields: BlockField[];
}

// ───────────────────────────── CTAs ─────────────────────────────

export interface WebsiteCta {
  id: number;
  key: string;
  type: string;
  type_label?: string;
  label_en: string;
  label_ar: string | null;
  sublabel_en?: string | null;
  sublabel_ar?: string | null;
  url?: string | null;
  page_id?: number | null;
  product_id?: number | null;
  form_id?: number | null;
  phone?: string | null;
  message_en?: string | null;
  message_ar?: string | null;
  placement?: string | null;
  style?: string | null;
  icon?: string | null;
  tracking_key?: string | null;
  is_enabled: boolean;
  /** `GET /ctas/{id}` adds an EN/AR render preview. */
  preview?: ByLocale<unknown>;
  created_at?: string;
  updated_at?: string;
  [extra: string]: unknown;
}

export type CtaInput = Partial<Omit<Known<WebsiteCta>, 'id' | 'preview' | 'created_at' | 'updated_at'>>;

// ───────────────────────────── products / categories ─────────────────────────────

export interface ProductTranslation {
  locale?: Locale;
  name: string;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  features?: { title: string; description?: string | null }[];
  specifications?: { label: string; value: string }[];
  is_enabled?: boolean;
  url?: string;
  seo?: SeoMeta | null;
  geo?: GeoMeta | null;
}

export interface ProductTier {
  id?: number;
  name_en: string;
  name_ar?: string | null;
  price: number | string | null;
  billing_period?: string | null;
  features_en?: string[];
  features_ar?: string[];
  is_recommended?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface WebsiteProduct {
  id: number;
  type: string;
  sku: string | null;
  status: 'draft' | 'published' | 'archived';
  status_label?: string;
  category_id: number | null;
  category?: WebsiteCategory | null;
  pricing_type: string;
  price: number | string | null;
  compare_at_price: number | string | null;
  currency: string;
  billing_period: string | null;
  is_price_public: boolean;
  availability: string;
  is_featured: boolean;
  is_purchasable: boolean;
  min_quantity: number;
  max_quantity: number;
  subscription_plan_id: number | null;
  featured_media_id: number | null;
  featured_media?: WebsiteMedia | null;
  gallery?: (number | WebsiteMedia)[];
  sort_order: number;
  /** Either an array (rows) or keyed by locale, depending on endpoint. */
  translations: ProductTranslation[] | ByLocale<ProductTranslation>;
  tiers?: ProductTier[];
  sources?: WebsiteSource[];
  faqs?: WebsiteFaq[];
  ctas?: AttachedCta[];
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  [extra: string]: unknown;
}

export interface ProductInput {
  type?: string;
  sku?: string | null;
  status?: WebsiteProduct['status'];
  category_id?: number | null;
  pricing_type?: string;
  price?: number | null;
  compare_at_price?: number | null;
  currency?: string;
  billing_period?: string | null;
  is_price_public?: boolean;
  availability?: string;
  is_featured?: boolean;
  is_purchasable?: boolean;
  min_quantity?: number;
  max_quantity?: number;
  subscription_plan_id?: number | null;
  featured_media_id?: number | null;
  gallery?: number[];
  sort_order?: number;
  translations?: ByLocale<ProductTranslation>;
  tiers?: ProductTier[];
}

export interface ProductRelationsInput {
  sources?: WebsiteSource[];
  faq_ids?: number[];
  ctas?: { cta_id: number; placement: string; is_enabled?: boolean }[];
}

export interface WebsiteCategory {
  id: number;
  kind: 'product' | 'article';
  name?: string;
  name_en: string;
  name_ar?: string | null;
  slug_en?: string | null;
  slug_ar?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  parent_id?: number | null;
  sort_order?: number;
  is_active?: boolean;
  [extra: string]: unknown;
}

export type CategoryInput = Partial<Omit<Known<WebsiteCategory>, 'id' | 'name'>>;

// ───────────────────────────── purchases ─────────────────────────────

export interface PurchaseItem {
  id: number;
  product_id: number;
  price_tier_id: number | null;
  product_name: string;
  tier_name: string | null;
  sku: string | null;
  pricing_type: string;
  unit_price: string | null;
  quantity: number;
  line_total: string | null;
  currency: string;
  billing_period: string | null;
  notes: string | null;
}

export interface StatusHistoryRow {
  from_status: string | null;
  to_status: string;
  reason?: string | null;
  actor: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  performed_by?: { id: number; name: string } | null;
}

export interface Attribution {
  session_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  cta_id?: number | null;
  [extra: string]: unknown;
}

export interface WebsitePurchase {
  id: number;
  reference: string;
  status: string;
  status_label?: string;
  allowed_statuses: string[];
  organization_name: string;
  organization_type: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  notes: string | null;
  currency: string;
  estimated_total: string | null;
  has_unpriced_items: boolean;
  items: PurchaseItem[];
  decision_reason: string | null;
  can_cancel: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
  history?: StatusHistoryRow[];
  user?: { id: number; name: string } | null;
  hospital_id: number | null;
  organization_id: number | null;
  assigned_to: { id: number; name: string } | null;
  internal_notes: string | null;
  locale: Locale;
  consent: boolean;
  attribution?: Attribution | null;
}

// ───────────────────────────── leads / forms ─────────────────────────────

export interface LeadAttachment {
  index: number;
  field: string;
  original_name: string;
  mime_type: string;
  size: number;
  download_url: string;
}

export interface WebsiteLead {
  id: number;
  reference: string;
  type: string;
  type_label?: string;
  status: string;
  status_label?: string;
  allowed_statuses: string[];
  form: { id: number; key: string; name: string } | null;
  name: string | null;
  organization: string | null;
  hospital: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  job_title: string | null;
  locale: Locale;
  assigned_to: { id: number; name: string } | null;
  message: string | null;
  data?: Record<string, unknown>;
  attachments?: LeadAttachment[];
  product?: { id: number; name: string } | null;
  page?: { id: number; title: string } | null;
  cta?: { id: number; key: string; tracking_key: string } | null;
  consent?: boolean;
  consent_at?: string | null;
  attribution?: Attribution | null;
  internal_notes?: string | null;
  spam_reason?: string | null;
  contacted_at?: string | null;
  converted_at?: string | null;
  closed_at?: string | null;
  created_at?: string;
  history?: StatusHistoryRow[];
}

export interface FormFieldOption {
  value: string;
  label_en: string;
  label_ar?: string | null;
}

export interface FormFieldVisibility {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'filled' | 'empty';
  value?: unknown;
}

export interface FormFieldValidation {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  mimes?: string[];
  max_kb?: number;
  max_files?: number;
}

export interface WebsiteFormField {
  id?: number;
  key: string;
  type: string;
  label_en: string;
  label_ar?: string | null;
  placeholder_en?: string | null;
  placeholder_ar?: string | null;
  help_en?: string | null;
  help_ar?: string | null;
  is_required?: boolean;
  maps_to?: string | null;
  options?: FormFieldOption[];
  validation?: FormFieldValidation | null;
  visibility?: FormFieldVisibility | null;
  sort_order?: number;
}

export interface WebsiteForm {
  id: number;
  key: string;
  type: string;
  is_system?: boolean;
  name?: string;
  name_en: string;
  name_ar?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  submit_label_en?: string | null;
  submit_label_ar?: string | null;
  success_message_en?: string | null;
  success_message_ar?: string | null;
  requires_consent?: boolean;
  consent_text_en?: string | null;
  consent_text_ar?: string | null;
  notify_emails?: string[];
  is_active: boolean;
  leads_count?: number;
  fields?: WebsiteFormField[];
  [extra: string]: unknown;
}

export type FormInput = Partial<Omit<Known<WebsiteForm>, 'id' | 'leads_count' | 'name' | 'is_system'>>;

// ───────────────────────────── authors / FAQs ─────────────────────────────

export interface WebsiteAuthor {
  id: number;
  slug: string;
  name?: string;
  name_en: string;
  name_ar?: string | null;
  job_title_en?: string | null;
  job_title_ar?: string | null;
  credentials_en?: string | null;
  credentials_ar?: string | null;
  bio_en?: string | null;
  bio_ar?: string | null;
  photo_media_id?: number | null;
  photo?: WebsiteMedia | null;
  same_as?: string[];
  email?: string | null;
  user_id?: number | null;
  is_active: boolean;
  articles_count?: number;
  [extra: string]: unknown;
}

export type AuthorInput = Partial<Omit<Known<WebsiteAuthor>, 'id' | 'name' | 'photo' | 'articles_count'>>;

export interface WebsiteFaq {
  id: number;
  locale: Locale;
  question: string;
  answer: string;
  group_key?: string | null;
  is_global: boolean;
  status: string;
  sort_order: number;
  used_by_pages?: unknown[] | number;
  used_by_products?: unknown[] | number;
  [extra: string]: unknown;
}

export type FaqInput = Partial<Omit<Known<WebsiteFaq>, 'id' | 'used_by_pages' | 'used_by_products'>>;

// ───────────────────────────── menus ─────────────────────────────

export interface MenuItemNode {
  id?: number;
  label: string;
  page_id?: number | null;
  url?: string | null;
  target?: string | null;
  children?: MenuItemNode[];
  [extra: string]: unknown;
}

export interface WebsiteMenu {
  id?: number;
  key: string;
  name?: string;
  /** Items per language. */
  items?: ByLocale<MenuItemNode[]> | MenuItemNode[];
  ctas?: AttachedCta[];
  [extra: string]: unknown;
}

// ───────────────────────────── settings / SEO infra ─────────────────────────────

export interface WebsiteSetting {
  key: string;
  group: string;
  type: string;
  value: unknown;
  default: unknown;
  is_default: boolean;
  description: string | null;
  updated_by: unknown;
  updated_at: string | null;
}

export interface WebsiteRedirect {
  id: number;
  source_path: string;
  destination: string;
  status_code: number;
  is_active: boolean;
  is_automatic: boolean;
  hits: number;
  last_hit_at: string | null;
  notes: string | null;
  created_by: unknown;
  created_at: string;
}

export type RedirectInput = Partial<Pick<WebsiteRedirect, 'source_path' | 'destination' | 'status_code' | 'is_active' | 'notes'>>;

export interface RobotsRule {
  id: number;
  user_agent: string;
  allow: string[];
  disallow: string[];
  block_all: boolean;
  crawl_delay: number | null;
  is_enabled: boolean;
  notes: string | null;
  sort_order?: number;
  [extra: string]: unknown;
}

export type RobotsRuleInput = Partial<Omit<Known<RobotsRule>, 'id'>>;

export interface LlmsEntry {
  id: number;
  section: string;
  title: string;
  url: string;
  description: string | null;
  sort_order: number;
  [extra: string]: unknown;
}

export type LlmsEntryInput = Partial<Omit<Known<LlmsEntry>, 'id'>>;

export interface SitemapInfo {
  index_url: string;
  locales: {
    locale: Locale;
    url: string;
    total: number;
    by_type: Record<string, number>;
    files: number;
    lastmod: string | null;
  }[];
}

export interface ResolvedUrl {
  canonical: string;
  robots: string;
  is_indexable: boolean;
  reason: string | null;
  page: number | null;
  clean_path: string | null;
  locale: Locale | null;
}

export interface CrawlerVisibility {
  window_days: number;
  crawlers: {
    crawler: string;
    allowed: boolean;
    last_seen_at: string | null;
    hits_in_window: number;
    by_resource: Record<string, number>;
    status: 'ok' | 'no_recent_visits' | 'blocked';
  }[];
}

// ───────────────────────────── analytics / audit / roles ─────────────────────────────

export interface AnalyticsRange {
  from?: string;
  to?: string;
}

export interface AnalyticsSummary {
  sessions: number;
  events: Record<string, number>;
  conversions: number;
  conversion_rate: number;
  leads: number;
  purchases: number;
  funnel: { step: string; count: number }[];
  daily: ({ day: string } & Record<string, number | string>)[];
}

export interface CtaAnalyticsRow {
  tracking_key: string;
  placement: string | null;
  clicks: number;
  conversions: number;
  conversion_rate: number;
}

export interface PageAnalyticsRow {
  path: string;
  page_id: number | null;
  views: number;
  cta_clicks: number;
  conversions: number;
  conversion_rate: number;
}

export interface CampaignAnalyticsRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  views: number;
  conversions: number;
  purchases_completed: number;
}

export interface AnalyticsEvent {
  id: number;
  event: string;
  session_id: string | null;
  path: string | null;
  cta_tracking_key?: string | null;
  placement?: string | null;
  created_at: string;
  [extra: string]: unknown;
}

export interface AuditLogRow {
  id: number;
  admin: { id: number; name: string; email: string } | null;
  method: string;
  path: string;
  status: number;
  action: string | null;
  entity_type: string | null;
  entity_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface WebsiteRole {
  id: number;
  name: string;
  is_system: boolean;
  permissions: string[];
  admins_count: number;
}

export interface WebsiteAdmin {
  id: number;
  name: string;
  email: string;
  status: string;
  roles: string[];
}

export interface PermissionCatalog {
  all: string[];
  grouped: Record<string, string[]>;
}

// ───────────────────────────── shared list params ─────────────────────────────

export interface ListParams {
  page?: number;
  per_page?: number;
  q?: string;
  [filter: string]: string | number | boolean | undefined | null;
}

/** `meta.counts` on leads / purchases lists, for status tabs. */
export interface CountsMeta {
  pagination?: import('../../models/api-response.model').ApiPagination;
  counts?: Record<string, number>;
}
