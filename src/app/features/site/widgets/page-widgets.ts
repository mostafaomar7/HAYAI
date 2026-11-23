import { firstValueFrom } from 'rxjs';
import { Dict, PagePayload, PageSection, PageWidgets, SiteData, WidgetList } from '../models/site.models';
import { SiteApiService } from '../services/site-api.service';
import { SiteLocale } from '../site-paths';
import { arr, str } from '../site-utils';

/**
 * Where the website 2026 widgets go on a CMS page.
 *
 * The pages and their copy live in the CMS; the widgets are live data placed
 * on top of them. Nothing here knows a page id or a slug: a widget is attached
 * by something the admin controls in the dashboard.
 *
 * - Doctor search: the page's Doctor list block (search form in the page
 *   hero, results and the specialty / area grids where the block sits).
 * - Hospital directory: a Hospital list block, or a block whose anchor is
 *   `hospital-directory` (or `partners`, the anchor the hospitals page
 *   already uses). An anchored block stays as the fallback while the
 *   directory has no rows.
 * - ICU availability: the page that Settings → Emergency bar links to, after
 *   its first block, or after the block anchored `icu-availability`.
 * - Guides search: the block anchored `guides` (an Article list).
 * - Home (page type `home`): search box, quick chips, ICU card.
 */
export const WIDGET_ANCHORS = {
  hospitals: ['hospital-directory', 'partners'],
  icu: 'icu-availability',
  guides: 'guides'
} as const;

export interface WidgetPlan {
  home: boolean;
  doctors: PageSection | null;
  hospitals: PageSection | null;
  /** The ICU list renders after this section (null = at the top). */
  icuAfter: PageSection | null;
  icu: boolean;
  guides: PageSection | null;
}

const NO_PLAN: WidgetPlan = { home: false, doctors: null, hospitals: null, icuAfter: null, icu: false, guides: null };

export function widgetPlan(page: PagePayload | null | undefined, site: SiteData | null, locale: SiteLocale): WidgetPlan {
  if (!page || page.is_preview) return NO_PLAN;
  const sections = arr<PageSection>(page.sections).filter(s => s?.type);
  const anchored = (a: string) => sections.find(s => s.anchor === a) ?? null;

  const icuPath = icuPagePath(site);
  const isIcuPage = !!icuPath && samePath(icuPath, page.path ?? '', locale);
  const icuAnchor = anchored(WIDGET_ANCHORS.icu);

  return {
    home: page.type === 'home',
    doctors: sections.find(s => s.type === 'doctor_list') ?? null,
    hospitals:
      sections.find(s => s.type === 'hospital_list') ??
      WIDGET_ANCHORS.hospitals.map(anchored).find(Boolean) ??
      null,
    icu: isIcuPage || !!icuAnchor,
    icuAfter: icuAnchor ?? (isIcuPage ? sections[0] ?? null : null),
    guides: anchored(WIDGET_ANCHORS.guides)
  };
}

/** The ICU & emergency page, as Settings → Emergency bar names it. */
export function icuPagePath(site: SiteData | null): string | null {
  return str(site?.emergency_bar?.link?.path) || null;
}

function samePath(a: string, pagePath: string, locale: SiteLocale): boolean {
  const norm = (p: string) => {
    let s = p;
    try {
      s = decodeURI(p);
    } catch {}
    s = s.replace(/\/+$/, '');
    return s.startsWith(`/${locale}`) ? s : `/${locale}${s.startsWith('/') ? '' : '/'}${s}`;
  };
  return norm(a) === norm(pagePath);
}

/** URL parameters each widget reads; anything else is dropped. */
const DOCTOR_KEYS = ['q', 'specialty', 'subspecialty', 'area', 'hospital', 'page'];
const HOSPITAL_KEYS = ['area', 'insurer', 'service', 'icu_only', 'page'];
const ICU_KEYS = ['area', 'hospital'];
const GUIDE_KEYS = ['q', 'category', 'page'];
/** Any of these in the URL makes the page a filtered view (noindex). */
export const FILTER_KEYS = [...new Set([...DOCTOR_KEYS, ...HOSPITAL_KEYS, ...ICU_KEYS, ...GUIDE_KEYS])];

export function pick(query: Record<string, string>, keys: readonly string[], extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  for (const k of keys) {
    const v = str(query[k]);
    if (v) p.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

/** A listing call that never fails the page: errors and 404s are no rows. */
async function list(api: SiteApiService, locale: SiteLocale, endpoint: string, qs: string): Promise<WidgetList> {
  try {
    const res = await firstValueFrom(api.listing(locale, endpoint, qs));
    const data = res?.data;
    return { items: Array.isArray(data) ? data : arr<Dict>(data?.items, data?.data), meta: (res?.meta as Dict) ?? null };
  } catch {
    return { items: [], meta: null };
  }
}

/** Fetches every widget's data for this page in parallel. Null when none. */
export async function loadPageWidgets(
  api: SiteApiService,
  locale: SiteLocale,
  plan: WidgetPlan,
  query: Record<string, string>
): Promise<PageWidgets | null> {
  if (!plan.home && !plan.doctors && !plan.hospitals && !plan.icu && !plan.guides) return null;
  const w: PageWidgets = { query };
  const jobs: Promise<unknown>[] = [];
  const needAreas = plan.home || !!plan.doctors;

  if (needAreas) jobs.push(list(api, locale, 'areas', '').then(r => (w.areas = r.items)));
  if (plan.home || plan.icu) {
    const qs = plan.icu ? pick(query, ICU_KEYS) : '';
    jobs.push(list(api, locale, 'icu-availability', qs).then(r => (w.icu = r)));
  }
  if (plan.doctors) {
    jobs.push(list(api, locale, 'doctors', pick(query, DOCTOR_KEYS, { per_page: '12' })).then(r => (w.doctors = r)));
    jobs.push(list(api, locale, 'doctors/specialties', '').then(r => (w.specialties = r.items)));
  }
  if (plan.hospitals) {
    jobs.push(list(api, locale, 'hospitals', pick(query, HOSPITAL_KEYS, { per_page: '12' })).then(r => (w.hospitals = r)));
  }
  if (plan.guides) {
    jobs.push(list(api, locale, 'articles', pick(query, GUIDE_KEYS, { per_page: '12' })).then(r => (w.articles = r)));
    jobs.push(list(api, locale, 'categories', 'kind=article').then(r => (w.categories = r.items)));
  }
  await Promise.all(jobs);
  return w;
}

/** Build D: a hospital profile's ICU rows and doctors. */
export async function loadHospitalWidgets(api: SiteApiService, locale: SiteLocale, slug: string): Promise<PageWidgets> {
  const w: PageWidgets = { query: {} };
  const qs = new URLSearchParams({ hospital: slug }).toString();
  await Promise.all([
    list(api, locale, 'icu-availability', qs).then(r => (w.icu = r)),
    list(api, locale, 'doctors', `${qs}&per_page=48`).then(r => (w.doctors = r))
  ]);
  return w;
}
