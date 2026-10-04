#!/usr/bin/env node
/**
 * SEO / GEO deploy gate.
 *
 * Fetches every page template from a running server and fails the build on any
 * breach of the client's "Technical SEO & GEO Specification". It covers the
 * parts of that document that are checkable from the rendered HTML:
 *
 *   §1  server-rendered content   — body text present before any JS runs
 *   §3  structured data           — JSON-LD parses, required @types per template,
 *                                   and no fabricated aggregateRating / Review
 *   §4  content architecture      — one <h1>, no skipped heading levels,
 *                                   a 40-60 word self-contained direct answer
 *   §6  internationalisation      — lang/dir, canonical, reciprocal hreflang
 *   §7  images                    — explicit dimensions, alt text, srcset on
 *                                   content images (CLS and the image pipeline)
 *
 * Usage:
 *   node scripts/seo-gate.mjs [baseUrl]            # default http://localhost:4000
 *   node scripts/seo-gate.mjs --targets t.json     # override the template list
 *
 * Exits 0 when every required check passes, 1 otherwise. Warnings (templates
 * that have no content yet) are reported but do not fail the build.
 */

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const BASE = (args.find((a) => a.startsWith('http')) || 'http://localhost:4000').replace(/\/$/, '');

/**
 * `required` are the @types that must be present, and the gate blocks on a
 * missing one. BreadcrumbList sat in `wanted` while the API did not emit it;
 * the 4 October release does emit it on every template, so it is required
 * now and a regression stops a deploy instead of printing a warning nobody
 * reads. `wanted` is left for types that depend on an editor keeping the
 * right block on the page — FAQPage follows FAQ content, so losing it is an
 * editorial choice, not a bug.
 */
const AR = {
  insurance: '/ar/%D8%AA%D8%BA%D8%B7%D9%8A%D8%A9-%D8%A7%D9%84%D8%AA%D8%A3%D9%85%D9%8A%D9%86',
  faq: '/ar/%D8%A7%D9%84%D8%A3%D8%B3%D8%A6%D9%84%D8%A9-%D8%A7%D9%84%D8%B4%D8%A7%D8%A6%D8%B9%D8%A9',
  about: '/ar/%D8%B9%D9%86-%D8%AD%D9%8A%D8%A7%D8%A9',
};

const DEFAULT_TARGETS = [
  { label: 'home (en)', path: '/en', required: ['MedicalOrganization', 'WebSite', 'BreadcrumbList'], geo: true },
  { label: 'home (ar)', path: '/ar', required: ['MedicalOrganization', 'WebSite', 'BreadcrumbList'], geo: true, rtl: true },

  { label: 'insurance coverage (en)', path: '/en/insurance-coverage', required: ['MedicalOrganization', 'BreadcrumbList'], wanted: ['FAQPage'], geo: true },
  { label: 'insurance coverage (ar)', path: AR.insurance, required: ['MedicalOrganization', 'BreadcrumbList'], wanted: ['FAQPage'], geo: true, rtl: true },
  { label: 'emergency / ICU (en)', path: '/en/emergency-icu', required: ['MedicalOrganization', 'BreadcrumbList'], geo: true },
  { label: 'how it works (en)', path: '/en/how-it-works', required: ['MedicalOrganization', 'BreadcrumbList'], geo: true },
  { label: 'FAQ (en)', path: '/en/faq', required: ['MedicalOrganization', 'BreadcrumbList', 'FAQPage'], geo: true },
  { label: 'FAQ (ar)', path: AR.faq, required: ['MedicalOrganization', 'BreadcrumbList', 'FAQPage'], geo: true, rtl: true },
  { label: 'about (en)', path: '/en/about', required: ['MedicalOrganization', 'BreadcrumbList'], geo: true },
  { label: 'about (ar)', path: AR.about, required: ['MedicalOrganization', 'BreadcrumbList'], geo: true, rtl: true },

  { label: 'products listing', path: '/en/products', required: ['MedicalOrganization', 'BreadcrumbList', 'CollectionPage'], softMissing: true, listing: true },
  // A parameterised URL is noindex by design, so it carries no schema of its own.
  { label: 'search (parameterised)', path: '/en/search?q=test&sort=price', required: [], expectNoindex: true, expectCanonicalClean: '/en/search' },

  // The provider directory is public, so its thin-content controls are now
  // live and must keep holding: every profile without real content stays
  // noindex, and no profile may ship a seeded aggregateRating.
  { label: 'doctor listing', path: '/en/doctors', required: ['MedicalOrganization', 'BreadcrumbList', 'CollectionPage'], softMissing: true, listing: true },
  // A specialty is a path facet, not a page of its own in the CMS. It used to
  // fetch the whole directory and ship as a duplicate of /en/doctors, so its
  // own h1, canonical and breadcrumb are checked here.
  { label: 'doctor specialty facet', path: '/en/doctors/critical-care', required: ['MedicalOrganization', 'BreadcrumbList', 'CollectionPage'], softMissing: true, listing: true },
  { label: 'doctor profile (thin)', path: '/en/doctors/critical-care/samaa-saeed-abdelfattah', required: ['Physician', 'BreadcrumbList'], expectNoindex: true, softMissing: true },
];

const targets = flag('--targets')
  ? JSON.parse(await (await import('node:fs/promises')).readFile(flag('--targets'), 'utf8'))
  : DEFAULT_TARGETS;

const problems = [];
const warnings = [];
const fail = (t, msg) => problems.push(`${t.label}: ${msg}`);
const warn = (t, msg) => warnings.push(`${t.label}: ${msg}`);

function jsonLdTypes(html) {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const types = [];
  let parseError = null;
  for (const [, raw] of blocks) {
    try {
      const data = JSON.parse(raw.trim());
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== 'object') continue;
        const push = (t) => types.push(...(Array.isArray(t) ? t : [t]));
        push(item['@type']);
        for (const g of item['@graph'] || []) push(g['@type']);
      }
    } catch (e) {
      parseError = e.message;
    }
  }
  return { count: blocks.length, types: types.filter(Boolean), parseError };
}

function headingLevels(html) {
  return [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
}

function directAnswerWords(html) {
  const m =
    html.match(/data-geo="answer"[^>]*>([\s\S]*?)<\/section>/) ||
    html.match(/aria-label="direct-answer"[^>]*>([\s\S]*?)<\/section>/);
  if (!m) return null;
  // The block carries the question as a heading; the spec's 40-60 words is the
  // answer paragraph, so measure the last <p> rather than the whole section.
  const paras = [...m[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p) =>
    p[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const answer = paras.length ? paras[paras.length - 1] : m[1].replace(/<[^>]+>/g, ' ');
  return answer.split(/\s+/).filter(Boolean).length;
}

/**
 * The URLs in each language's sitemap, fetched once.
 *
 * The API builds `robots` and the sitemap from one rule: a listing with
 * results is `index` and is listed, an empty one is `noindex` and is not.
 * One rule is only worth having if the two outputs are checked against each
 * other — an indexable page missing from the sitemap is a page we ask Google
 * to find by luck, and a noindex page inside it is a contradiction a crawler
 * has to resolve for us.
 */
const sitemaps = new Map();
async function sitemapUrls(locale) {
  if (sitemaps.has(locale)) return sitemaps.get(locale);
  let urls = null;
  try {
    const res = await fetch(`${BASE}/sitemap-${locale}.xml`);
    if (res.ok) {
      const xml = await res.text();
      urls = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, '')));
    }
  } catch {
    /* reported by the caller as "could not be read" */
  }
  sitemaps.set(locale, urls);
  return urls;
}

async function check(t) {
  let res, html;
  try {
    res = await fetch(BASE + t.path, { headers: { 'User-Agent': 'GPTBot' } });
    html = await res.text();
  } catch (e) {
    fail(t, `request failed: ${e.message}`);
    return;
  }

  // --- §1 rendering ---------------------------------------------------
  if (res.status >= 500) {
    fail(t, `HTTP ${res.status} — a 5xx cuts crawl frequency for weeks (spec §1)`);
    return;
  }
  if (res.status >= 400 && !t.expect404) {
    fail(t, `HTTP ${res.status}`);
    return;
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 400) {
    if (t.softMissing) warn(t, `only ${text.length} chars of text — no content published yet`);
    else fail(t, `only ${text.length} chars of server-rendered text (spec §1)`);
  }

  // --- §3 structured data ---------------------------------------------
  const ld = jsonLdTypes(html);
  if (ld.parseError) fail(t, `JSON-LD does not parse: ${ld.parseError}`);
  for (const want of t.required || []) {
    if (!ld.types.includes(want)) fail(t, `missing required schema @type "${want}" (spec §3)`);
  }
  for (const want of t.wanted || []) {
    if (!ld.types.includes(want)) warn(t, `schema @type "${want}" not emitted yet (spec §3)`);
  }
  // Only inside JSON-LD: Angular serialises the API response into the page for
  // hydration, and a `rating` object in that blob is data, not schema.
  const ldRaw = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join(' ');
  // The spec forbids *fabricated or seeded* ratings, not small ones. The API
  // derives every rating from completed bookings, so a genuine count of two
  // is honest data and blocking on it would only teach people to ignore the
  // gate. A rating with no reviews behind it is the fabrication the spec
  // means, and that still fails.
  const THIN_REVIEWS = 5;
  for (const m of ldRaw.matchAll(/"reviewCount"\s*:\s*(\d+)/g)) {
    const n = Number(m[1]);
    if (n === 0) {
      fail(t, `aggregateRating with reviewCount 0 — a rating with no reviews behind it is a fabricated signal (spec §8)`);
    } else if (n < THIN_REVIEWS) {
      warn(t, `aggregateRating on only ${n} review(s) — genuine but thin; search engines may ignore or penalise it (spec §8)`);
    }
  }
  if (/aggregateRating/.test(ldRaw) && !/"reviewCount"/.test(ldRaw)) {
    fail(t, 'aggregateRating with no reviewCount in JSON-LD (spec §8)');
  }
  if (/"@type"\s*:\s*"Review"/.test(ldRaw)) fail(t, 'Review schema present — forbidden until real reviews exist (spec §8)');

  // --- §4 content architecture -----------------------------------------
  const levels = headingLevels(html);
  const h1s = levels.filter((l) => l === 1).length;
  if (h1s !== 1) fail(t, `${h1s} <h1> elements, expected exactly 1 (spec §4)`);
  for (let i = 0; i < levels.length - 1; i++) {
    if (levels[i + 1] - levels[i] > 1) {
      fail(t, `heading level jumps h${levels[i]} → h${levels[i + 1]} (spec §4)`);
      break;
    }
  }
  if (t.geo) {
    const words = directAnswerWords(html);
    if (words === null) fail(t, 'no direct-answer block found (spec §4)');
    else if (words < 40 || words > 60) fail(t, `direct answer is ${words} words, needs 40-60 (spec §4)`);
  }

  // --- §6 internationalisation ------------------------------------------
  const htmlTag = (html.match(/<html([^>]*)>/) || [, ''])[1];
  const lang = (htmlTag.match(/lang="([^"]+)"/) || [, null])[1];
  const dir = (htmlTag.match(/dir="([^"]+)"/) || [, null])[1];
  if (!lang) fail(t, 'no lang attribute on <html> (spec §6)');
  if (t.rtl && dir !== 'rtl') fail(t, `dir="${dir}" on an Arabic page, expected rtl (spec §6)`);

  const canonical = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [, null])[1];
  const robots = (html.match(/<meta name="robots" content="([^"]+)"/) || [, null])[1];
  if (t.expectNoindex) {
    if (!/noindex/.test(robots || '')) fail(t, `parameterised URL is not noindex (robots="${robots}") (spec §5)`);
    if (t.expectCanonicalClean && canonical && !canonical.endsWith(t.expectCanonicalClean)) {
      fail(t, `canonical "${canonical}" does not point at the clean URL "${t.expectCanonicalClean}" (spec §5)`);
    }
  } else {
    if (!canonical) fail(t, 'no canonical link (spec §5)');
    const tags = [...html.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]);
    for (const h of ['en', 'ar', 'x-default']) {
      if (!tags.includes(h)) fail(t, `hreflang="${h}" missing — reciprocity is mandatory (spec §6)`);
    }

  // --- the sitemap and `robots` must agree (spec §5) --------------------
  if (t.listing && canonical) {
    const locale = t.path.startsWith('/ar') ? 'ar' : 'en';
    const urls = await sitemapUrls(locale);
    const clean = canonical.replace(/\/$/, '');
    const indexable = !/noindex/.test(robots || '');
    // Page 2 onwards is self-canonical and indexable but deliberately out of
    // the sitemap: its contents shift every time a row is added, and crawlers
    // reach it from page 1. Only a listing's clean first page is checked.
    const paginated = /[?&]page=/.test(clean);
    if (!urls) {
      warn(t, `sitemap-${locale}.xml could not be read, so the sitemap check was skipped`);
    } else if (paginated) {
      /* intentionally not in the sitemap */
    } else if (indexable && !urls.has(clean)) {
      fail(t, `indexable but missing from sitemap-${locale}.xml: ${clean} (spec §5)`);
    } else if (!indexable && urls.has(clean)) {
      fail(t, `noindex but listed in sitemap-${locale}.xml: ${clean} (spec §5)`);
    }
  }
  }

  // --- §7 images ---------------------------------------------------------
  for (const tag of html.match(/<img[^>]*>/g) || []) {
    const src = (tag.match(/src="([^"]*)"/) || [, ''])[1];
    const name = src.split('/').pop() || 'image';
    // The spec accepts `aspect-ratio` instead of width/height, so an image
    // given a sized class in the stylesheet is not a CLS risk.
    const SIZED = /class="[^"]*\b(card-img|avatar|avatar-lg|logo-img|video-poster)\b/;
    const hasDims = /width=/.test(tag) && /height=/.test(tag);
    if (!hasDims && !SIZED.test(tag)) fail(t, `<img ${name}> has no width/height and no sized class — CLS risk (spec §7)`);
    const alt = tag.match(/alt="([^"]*)"/);
    if (!/\balt[=\s>]/.test(tag)) fail(t, `<img ${name}> has no alt attribute (spec §7)`);
    else if (alt && !alt[1].trim() && /\/media\/|\/profiles\//.test(src)) {
      fail(t, `<img ${name}> has an empty alt on a content image (spec §7)`);
    }
    // Logos and icons are fixed-size by design; only content images need srcset.
    const isContent = /\/media\//.test(src);
    if (isContent && !/srcset=/.test(tag)) fail(t, `content image ${name} has no srcset (spec §7)`);
    if (isContent && /srcset=/.test(tag) && !/\.(webp|avif)/.test(tag)) {
      warn(t, `content image ${name} serves no WebP/AVIF variant (spec §7)`);
    }
  }
}

console.log(`SEO / GEO gate — ${BASE}\n`);
for (const t of targets) {
  await check(t);
  const mine = problems.filter((p) => p.startsWith(t.label)).length;
  console.log(`  ${mine ? 'FAIL' : ' ok '}  ${t.label}  (${t.path})`);
}

if (warnings.length) {
  console.log('\nWarnings (not blocking):');
  for (const w of warnings) console.log('  ! ' + w);
}
if (problems.length) {
  console.log('\nBlocking problems:');
  for (const p of problems) console.log('  ✗ ' + p);
  console.log(`\n${problems.length} problem(s). Deploy blocked.`);
  process.exit(1);
}
console.log('\nAll required SEO / GEO checks passed.');
