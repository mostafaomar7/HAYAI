/**
 * Shapes of the public website API (`/api/v1/public`, contract section 18).
 *
 * Everything is typed loosely on purpose: the payload is produced by a CMS
 * whose editors can leave any optional field empty, and the API may add
 * fields over time. A missing optional field must never crash a server render
 * — a crash there is a blank page for Googlebot — so every renderer reads
 * these through optional chaining and falls back to "render nothing".
 */
import { SiteLocale } from '../site-paths';

export type Dict = Record<string, any>;

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: Dict;
}

/** Image (website-public-blocks.md §5.1). Doctor / hospital list entries carry a
 *  plain URL instead; those are wrapped as `{ url }` before rendering. */
export interface SiteImage {
  id?: number;
  kind?: 'image' | 'video';
  url: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  caption?: string | null;
  focal_point?: { x: number; y: number } | null;
  /** `null` for a few seconds after upload, while `variants` is `[]`. */
  srcset?: string | null;
  variants?: { width: number; height: number; url: string; mime_type?: string }[];
  mime_type?: string;
}

/** `kind` is the only thing to switch on (§5.2). */
export interface CtaAction {
  kind: 'link' | 'form' | 'purchase' | 'tel' | 'whatsapp' | string;
  href: string | null;
  target: '_self' | '_blank' | string;
  rel: string | null;
  form_key: string | null;
  product: { id: number; slug: string; path: string } | null;
}

/** Every button / link (§5.2). Inline one-off CTAs have `id` and `key` null. */
export interface SiteCta {
  id: number | null;
  key: string | null;
  type: string;
  label: string;
  sublabel: string | null;
  style: 'primary' | 'secondary' | 'outline' | 'link' | string;
  icon: string | null;
  placement: string | null;
  tracking_key: string;
  action: CtaAction;
}

export interface MenuItem {
  label: string;
  url?: string | null;
  path?: string | null;
  href?: string | null;
  target?: string | null;
  children?: MenuItem[];
}

export interface SiteData {
  locale: SiteLocale;
  lang: string;
  dir: 'ltr' | 'rtl';
  locales: { code: string; name: string; native: string; dir: string; hreflang: string; is_default: boolean }[];
  default_locale: string;
  base_url: string;
  organization: {
    name?: string;
    description?: string;
    logo_url?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    same_as?: string[];
  };
  menus: { header?: MenuItem[]; footer?: MenuItem[]; [key: string]: MenuItem[] | undefined };
  ctas: SiteCta[] | Record<string, SiteCta[]>;
  paths?: Record<string, string>;
  directory?: { doctors?: boolean; hospitals?: boolean };
  analytics?: { enabled?: boolean; endpoint?: string; events?: string[] };
  legal?: { privacy_url?: string | null };
  schema?: Dict[];
}

export interface SeoAlternate {
  hreflang: string;
  href: string;
  locale?: string;
}

export interface SeoData {
  title?: string;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
  is_indexable?: boolean;
  alternates?: SeoAlternate[];
  open_graph?: Dict | null;
  twitter?: Dict | null;
}

/**
 * One entry of `sections` (website-public-blocks.md §2). Every field listed for
 * a block is always present in `data`; the block shapes are in that file §6.
 * `id` is null only for the automatic FAQ section the server appends.
 */
export interface PageSection {
  id: number | null;
  type: string;
  anchor: string | null;
  settings: {
    hide_on: ('mobile' | 'desktop')[];
    theme: 'default' | 'light' | 'dark' | 'brand' | 'muted' | null;
    spacing: 'none' | 'compact' | 'normal' | 'spacious' | null;
  } | null;
  data: Dict;
}

export interface FormField {
  key: string;
  type: string;
  label: string;
  placeholder?: string | null;
  help?: string | null;
  required: boolean;
  /** `{}` or any of min, max, min_length, max_length. */
  validation: Dict;
  visibility: { field: string; operator: string; value?: any } | null;
  options: { value: string; label: string }[];
  /** File fields only (extensions, e.g. `["pdf","jpg"]`), else null. */
  accept: string[] | null;
  max_kb: number | null;
  max_files: number | null;
}

export interface FormDefinition {
  key: string;
  type?: string;
  name?: string;
  description?: string | null;
  submit_label?: string | null;
  success_message?: string | null;
  requires_consent?: boolean;
  consent_text?: string | null;
  privacy_url?: string | null;
  honeypot_field?: string | null;
  submit_endpoint: string;
  fields: FormField[];
}

/** Payload of `kind: page` (and of `/preview/{token}`), section 18.2. */
export interface PagePayload extends Dict {
  entity?: string;
  id?: number;
  type?: string;
  locale?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  path?: string;
  url?: string;
  title?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  h1?: { text?: string; source?: string; section_id?: number | null } | null;
  body?: string | null;
  sections?: PageSection[];
  ctas?: Record<string, SiteCta[]> | SiteCta[] | null;
  forms?: Record<string, FormDefinition> | null;
  sources?: Dict[];
  breadcrumbs?: { name: string; url?: string; path?: string }[];
  dates?: Dict | null;
  seo?: SeoData | null;
  schema_script?: string | null;
  geo?: Dict | null;
  is_preview?: boolean;
}

export type ResolveKind =
  | 'page'
  | 'product'
  | 'author'
  | 'doctor'
  | 'hospital'
  | 'listing'
  | 'redirect'
  | 'not_found';

export interface ResolveResult {
  kind: ResolveKind | 'error';
  status: number;
  data: any;
  redirect: { location?: string; url?: string; status?: number; status_code?: number } | null;
}

/** What the catch-all route resolves to: the API result plus anything the
 *  page needs fetched in the same server render (e.g. a listing's items). */
export interface ResolvedView {
  locale: SiteLocale;
  path: string;
  qs: string;
  result: ResolveResult;
  listing?: { kind: string; items: any; meta: Dict | null; seo: SeoData | null; query: Record<string, string> } | null;
}
