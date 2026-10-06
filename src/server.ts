/**
 * Node server for the HAYAI web app.
 *
 * - Public website (`/en/…`, `/ar/…`, `/preview`) is rendered on the server,
 *   so crawlers that never run JavaScript (Googlebot's first pass, GPTBot,
 *   ClaudeBot, PerplexityBot…) receive the full HTML: H1, price, JSON-LD.
 * - The admin dashboard (`/dashboard`, `/login`) is served as the normal
 *   client-side app from the same process (see app.routes.server.ts).
 * - robots.txt / llms.txt / sitemaps live in the CMS and are proxied here, so
 *   they are served from the website root where crawlers look for them.
 *
 * Environment:
 *   PORT                (default 4000)
 *   API_BASE_URL        (default https://api.hayaihealthcare.com/api/v1)
 *   WEBSITE_SERVER_KEY  sent as `X-Website-Key` on server→API calls; never to browsers
 *   SITE_URL            public origin (default https://hayaihealthcare.com)
 *   NG_ALLOWED_HOSTS    extra comma-separated host names allowed to be rendered
 *   GTM_ID              tag manager container; unset means no container is printed
 *   GTM_ENV_PARAMS      `gtm_auth=…&gtm_preview=…&gtm_cookies_win=x` for staging
 */
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse
} from '@angular/ssr/node';
import express, { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ATTRIBUTION_PARAMS } from './app/features/site/tracking-params';
import { Readable } from 'node:stream';

const browserDistFolder = join(import.meta.dirname, '../browser');

const API_BASE_URL = (process.env['API_BASE_URL'] || 'https://api.hayaihealthcare.com/api/v1').replace(/\/+$/, '');
const WEBSITE_KEY = process.env['WEBSITE_SERVER_KEY'] || '';
const SITE_URL = (process.env['SITE_URL'] || 'https://hayaihealthcare.com').replace(/\/+$/, '');
// Bare host (without "www."), so both the bare and the www host are allowed.
const siteHost = (() => {
  try {
    return new URL(SITE_URL).hostname.replace(/^www\./, '');
  } catch {
    return 'hayaihealthcare.com';
  }
})();

const app = express();
// Behind a reverse proxy / CDN: trust X-Forwarded-* for protocol and client IP.
app.set('trust proxy', true);
app.disable('x-powered-by');

const angularApp = new AngularNodeAppEngine({
  // SSRF protection: only these Host headers are rendered on the server.
  allowedHosts: [siteHost, `www.${siteHost}`, 'localhost', '127.0.0.1']
});

app.use(compression());

/* ------------------------------------------------------------------------
 * First-touch attribution, captured by the server.
 *
 * A patient who clicks an ad rarely converts on that page view. By the time
 * they send the form, the campaign parameters are three navigations behind
 * them. This keeps the first set seen for the whole visit, and promotes it to
 * a 90-day cookie once consent allows storage.
 *
 * Why the server and not JavaScript: Safari caps cookies written by scripts
 * at seven days, which loses most iPhone attribution before a patient
 * converts. An HttpOnly cookie written here lasts the full ninety and no
 * third-party tag in the container can read it.
 *
 * Why a session cookie for the first step: before the visitor has answered
 * the consent banner nothing may be stored durably, but the click id must
 * survive the next page or it is lost. A cookie that ends with the browser
 * is the narrowest thing that does that. It holds campaign identifiers only —
 * never anything about the patient.
 * --------------------------------------------------------------------- */

/**
 * The CMP's own cookie, and the value that means storage was allowed.
 *
 * CookieYes is the chosen banner. Once the subscription is live this should
 * be `CONSENT_COOKIE=cookieyes-consent` with a pattern matching its
 * advertisement grant — read the real cookie off the banner before setting
 * it, rather than trusting the shape documented here.
 *
 * Left empty on purpose until then. Unknown means denied, so nothing is
 * stored durably: the wrong guess here would keep a 90-day cookie on a
 * visitor who refused one.
 */
const CONSENT_COOKIE = process.env['CONSENT_COOKIE'] || '';
const CONSENT_GRANTED = process.env['CONSENT_GRANTED_PATTERN'] || 'granted';

const FT_SESSION_COOKIE = 'hayai_ft_s';
const FT_COOKIE = 'hayai_ft';
const FT_MAX_AGE = 90 * 864e5;

function readCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* a malformed cookie is not worth a 500 */
    }
  }
  return out;
}

/**
 * Whether the visitor has allowed storage. Unknown until the CMP is chosen
 * and `CONSENT_COOKIE` names its cookie — and unknown means no, so nothing is
 * stored durably by default.
 */
function consentAllows(cookies: Record<string, string>): boolean {
  if (!CONSENT_COOKIE) return false;
  const raw = cookies[CONSENT_COOKIE];
  return !!raw && new RegExp(CONSENT_GRANTED).test(raw);
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const cookies = readCookies(req.headers.cookie);
  const query = new URLSearchParams(req.url.split('?')[1] || '');
  const fresh: Record<string, string> = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = query.get(key);
    if (value) fresh[key] = value.slice(0, 200);
  }

  const stored = cookies[FT_COOKIE] || cookies[FT_SESSION_COOKIE];
  let ft: Record<string, unknown> | null = null;
  if (stored) {
    try {
      ft = JSON.parse(stored);
    } catch {
      ft = null;
    }
  }

  // The FIRST touch wins: a visitor who arrives from an ad and later returns
  // through a newsletter is still that ad's patient.
  if (!ft && Object.keys(fresh).length) {
    ft = { ...fresh, landing: req.path.slice(0, 200), ts: Date.now() };
    res.cookie(FT_SESSION_COOKIE, JSON.stringify(ft), {
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax'
    });
  }

  if (ft && !cookies[FT_COOKIE] && consentAllows(cookies)) {
    res.cookie(FT_COOKIE, JSON.stringify(ft), {
      maxAge: FT_MAX_AGE,
      httpOnly: true,
      secure: req.secure,
      sameSite: 'lax'
    });
    res.clearCookie(FT_SESSION_COOKIE);
  }

  // Read by the page metadata block as ft_source / ft_medium / ft_campaign.
  res.locals['ft'] = ft;
  next();
});

/* ------------------------------------------------------------------------
 * Internal traffic, marked by a cookie rather than by IP.
 *
 * GA4's own exclusion works on IP ranges, which does not survive contact with
 * reality here: Egyptian consumer lines are issued dynamically, and the team
 * is not always in the office. An address list would quietly stop matching
 * and staff visits would be counted as patients.
 *
 * So the team opts in once per device — /ar/?hayai_team=1 — and the flag
 * rides a one-year cookie from there. `?hayai_team=0` clears it, which
 * matters more than it looks: without it, whoever marks their laptop can
 * never again see the site the way a patient sees it.
 *
 * Deliberately not HttpOnly. It holds no personal data, and a reader in the
 * container is a useful second route to the same signal; being able to see it
 * in devtools is also how a team member confirms the opt-in worked.
 * --------------------------------------------------------------------- */
const TEAM_COOKIE = 'hayai_team';
const TEAM_MAX_AGE = 365 * 864e5;

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const flag = new URLSearchParams(req.url.split('?')[1] || '').get('hayai_team');
  if (flag === '1') {
    res.cookie(TEAM_COOKIE, '1', {
      maxAge: TEAM_MAX_AGE,
      secure: req.secure,
      sameSite: 'lax'
    });
    res.locals['internal'] = true;
  } else if (flag === '0') {
    res.clearCookie(TEAM_COOKIE);
    res.locals['internal'] = false;
  } else {
    res.locals['internal'] = readCookies(req.headers.cookie)[TEAM_COOKIE] === '1';
  }
  next();
});

/* ------------------------------------------------------------------------
 * Crawler visibility (Website → Crawlers in the dashboard).
 * Hits are counted in memory and flushed in batches — never awaited by a
 * request, so reporting can not slow down a page a crawler is waiting for.
 * --------------------------------------------------------------------- */
const CRAWLERS: [name: string, pattern: RegExp][] = [
  ['Googlebot', /Googlebot/i],
  ['Bingbot', /bingbot/i],
  ['GPTBot', /GPTBot/i],
  ['ChatGPT-User', /ChatGPT-User/i],
  ['OAI-SearchBot', /OAI-SearchBot/i],
  ['ClaudeBot', /ClaudeBot/i],
  ['Claude-User', /Claude-User/i],
  ['Claude-SearchBot', /Claude-SearchBot/i],
  ['PerplexityBot', /PerplexityBot/i],
  ['Perplexity-User', /Perplexity-User/i],
  ['CCBot', /CCBot/i]
];
type Resource = 'page' | 'robots' | 'sitemap' | 'llms';
const pendingHits = new Map<string, { user_agent: string; path: string; resource: Resource; count: number }>();
let pendingCount = 0;

function recordCrawlerHit(req: Request, resource: Resource): void {
  const ua = req.get('user-agent') || '';
  if (!ua || !CRAWLERS.some(([, re]) => re.test(ua))) return;
  const path = req.path.slice(0, 500);
  const key = `${ua}\n${path}\n${resource}`;
  const row = pendingHits.get(key);
  if (row) row.count++;
  else pendingHits.set(key, { user_agent: ua.slice(0, 500), path, resource, count: 1 });
  if (++pendingCount >= 50) flushCrawlerHits();
}

function flushCrawlerHits(): void {
  if (!pendingHits.size) return;
  const hits = [...pendingHits.values()];
  pendingHits.clear();
  pendingCount = 0;
  fetch(`${API_BASE_URL}/public/crawler-hits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(WEBSITE_KEY ? { 'X-Website-Key': WEBSITE_KEY } : {}) },
    body: JSON.stringify({ hits }),
    signal: AbortSignal.timeout(10_000)
  }).catch(() => {
    /* Best effort: visibility stats must never affect serving. */
  });
}
setInterval(flushCrawlerHits, 60_000).unref();

/* ------------------------------------------------------------------------
 * Crawler files proxied from the CMS: /robots.txt, /llms.txt,
 * /sitemap_index.xml, /sitemap-*.xml. Streamed through with the API's
 * content type and a short shared cache.
 * --------------------------------------------------------------------- */
const CRAWLER_FILE = /^\/(robots\.txt|llms\.txt|sitemap_index\.xml|sitemap-[a-z0-9_-]+\.xml)$/i;

app.get(CRAWLER_FILE, async (req: Request, res: Response, next: NextFunction) => {
  const file = req.path.slice(1);
  const resource: Resource = file === 'robots.txt' ? 'robots' : file === 'llms.txt' ? 'llms' : 'sitemap';
  recordCrawlerHit(req, resource);
  try {
    const upstream = await fetch(`${API_BASE_URL}/public/${file}`, {
      headers: { Accept: '*/*', ...(WEBSITE_KEY ? { 'X-Website-Key': WEBSITE_KEY } : {}) },
      signal: AbortSignal.timeout(15_000)
    });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || (file.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'));
    res.setHeader('Cache-Control', upstream.ok ? 'public, max-age=300, s-maxage=300' : 'no-store');
    const lastModified = upstream.headers.get('last-modified');
    if (lastModified) res.setHeader('Last-Modified', lastModified);
    if (!upstream.body) return void res.end();
    Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
  } catch (err) {
    // API unreachable: 503 tells crawlers to retry later (a 404 robots.txt
    // would read as "everything allowed", a 5xx as "back off").
    res.status(503).setHeader('Retry-After', '120').type('text/plain').send('Temporarily unavailable');
  }
});

/* ------------------------------------------------------------------------
 * Admin areas are never indexed, whatever robots.txt says.
 * --------------------------------------------------------------------- */
app.use((req, res, next) => {
  if (/^\/(dashboard|login)(\/|$)/i.test(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

/* ------------------------------------------------------------------------
 * `/` → default locale. 302 (not 301): the Arabic choice depends on the
 * browser's Accept-Language, and x-default stays English. Crawlers send no
 * Arabic preference, so they always land on /en.
 * --------------------------------------------------------------------- */
app.get('/', (req, res) => {
  const accept = (req.get('accept-language') || '').toLowerCase();
  const first = accept.split(',')[0]?.trim() ?? '';
  const locale = first.startsWith('ar') ? 'ar' : 'en';
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.setHeader('Vary', 'Accept-Language');
  res.setHeader('Cache-Control', 'private, max-age=0');
  res.redirect(302, `/${locale}${qs}`);
});

/* ------------------------------------------------------------------------
 * Static build output. Hashed bundles are immutable for a year; other public
 * files (logo, favicon, i18n dictionaries) are revalidated so a deploy shows
 * up immediately — the dashboard relies on fresh `assets/i18n/*.json`.
 * --------------------------------------------------------------------- */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (/-[A-Z0-9]{8}\.(js|css|mjs)$/i.test(filePath) || /[\\/]media[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/[\\/]i18n[\\/].+\.json$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  })
);

/* ------------------------------------------------------------------------
 * Any other URL (`/landing`, typos, old SPA links) gets the plain client
 * shell, exactly as on the static hosting. The router's wildcard decides
 * there: a signed-in admin goes to /dashboard, anyone else to the holding
 * page. Rendering it on the server instead would evaluate that redirect
 * without the admin's token (it lives in localStorage) and always send them
 * to the public site. Not part of the website, so noindex.
 * --------------------------------------------------------------------- */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (/^\/(en|ar|preview|login|dashboard)(\/|$)/i.test(req.path)) return next();
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(browserDistFolder, 'index.csr.html'));
});

/* ------------------------------------------------------------------------
 * Everything else: Angular. Public pages are rendered; dashboard routes get
 * the client shell.
 * --------------------------------------------------------------------- */
app.use((req, res, next) => {
  const isSite = /^\/(en|ar)(\/|$)/.test(req.path);
  if (isSite) recordCrawlerHit(req, 'page');
  const nonce = randomBytes(16).toString('base64');
  angularApp
    .handle(req)
    .then(async response => {
      if (!response) return next();
      // (try: headers of some Response objects are immutable)
      try {
      if (!response.headers.has('Cache-Control')) {
        if (/^\/(en|ar)\/requests\//.test(req.path) || req.path.startsWith('/preview')) {
          // Tokenised pages (order tracking, draft previews): never stored.
          response.headers.set('Cache-Control', 'no-store');
        } else if (isSite && response.status < 400) {
          // Short shared cache: the CMS publishes instantly, a CDN may hold a
          // page for a minute and serve stale while it refreshes.
          response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
        } else {
          response.headers.set('Cache-Control', 'no-cache');
        }
      }
      } catch {}

      const html = response.headers.get('Content-Type')?.includes('text/html');
      if (!html) return writeResponseToNodeResponse(response, res);

      // Buffered so the nonce can be stamped into the markup. A page is tens
      // of kilobytes; nothing here is worth streaming.
      //
      // The install goes in before the nonce pass, so its inline scripts are
      // stamped with the same nonce as everything else. The dashboard is an
      // internal tool and is not measured, so there the placeholders are just
      // removed — leaving them would print the literal text into the page.
      const rendered = await response.text();
      const body = withNonce(
        rendered
          .replaceAll('{{TRACKING_HEAD}}', isSite ? trackingHead(res, rendered, response.status) : '')
          .replaceAll('{{TRACKING_BODY}}', isSite ? trackingBody(res) : ''),
        nonce
      );
      res.status(response.status);
      response.headers.forEach((v, k) => {
        if (k.toLowerCase() !== 'content-length') res.setHeader(k, v);
      });
      res.setHeader('Content-Security-Policy-Report-Only', contentSecurityPolicy(nonce));
      return res.send(body);
    })
    .catch(next);
});

/* ------------------------------------------------------------------------
 * The tracking install — section 1 of the measurement spec.
 *
 * Three blocks, and the order between them is the whole point:
 *
 *   1. Consent defaults, everything denied. Consent Mode only works if the
 *      default state is already set when the first Google tag reads it. A
 *      container that loads first has already decided it may store things.
 *   2. Page metadata. The rules that stop ad tags firing on sensitive pages
 *      are read from the dataLayer, so the values have to be there before
 *      any tag can fire — not pushed by the app after hydration.
 *   3. The container.
 *
 * Built here rather than written into index.html so the order cannot be
 * broken by an edit to the template, and so the per-request values are
 * server-rendered: a tag that waits for Angular to push them has already
 * missed the page view.
 *
 * With no GTM_ID nothing of the container is printed at all — not an empty
 * loader, not a placeholder id. The consent and metadata blocks still go out,
 * because they are correct on their own and the staging container needs them.
 * --------------------------------------------------------------------- */
const GTM_ID = (process.env['GTM_ID'] || '').trim();
const GTM_ENV_PARAMS = (process.env['GTM_ENV_PARAMS'] || '').trim().replace(/^[?&]+/, '');

/**
 * The editorial fields, read back out of the render.
 *
 * They arrive with the page as `measurement` on the resolve payload, so by
 * the time Angular has rendered they are already sitting in the hydration
 * state. Reading them from there costs nothing; asking the API again would
 * cost a second round trip on every page view.
 *
 * Not derived from the URL, deliberately. The SEO spec allows transliterated
 * and Arabic-script slugs, and a URL pattern that silently stops matching a
 * renamed emergency page is exactly how ad tags end up firing on one.
 */
function measurementFields(html: string, status: number): Record<string, string> {
  // A 404 carries no payload by design, and the contract fixes its values
  // rather than leaving them to the fallback below. It is not an unclassified
  // page; it is a page that does not exist.
  if (status === 404) {
    return { page_sensitivity: 'standard', content_group: 'other', journey_stage: 'know' };
  }

  const match = /"measurement":(\{[^{}]{0,400}\})/.exec(html);
  const out: Record<string, string> = {};
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      for (const key of ['page_sensitivity', 'content_group', 'journey_stage']) {
        const value = parsed[key];
        if (typeof value === 'string' && value) out[key] = value;
      }
    } catch {
      /* fall through to the safe default below */
    }
  }
  // Unknown is treated as sensitive, never as standard. A page whose
  // classification did not arrive is a page nobody has judged, and the cost
  // of the two mistakes is not symmetric: suppressing ads on an ordinary
  // page loses a little attribution, firing them on an ICU page is the
  // failure the whole section exists to prevent. Analytics still runs.
  if (!out['page_sensitivity']) out['page_sensitivity'] = 'sensitive';
  return out;
}

/** What goes into the dataLayer before any tag can read it. */
function pageMetadata(res: Response, html: string, status: number): Record<string, unknown> {
  const out: Record<string, unknown> = measurementFields(html, status);
  const ft = res.locals['ft'] as Record<string, unknown> | null;
  if (ft) {
    if (ft['utm_source']) out['ft_source'] = ft['utm_source'];
    if (ft['utm_medium']) out['ft_medium'] = ft['utm_medium'];
    if (ft['utm_campaign']) out['ft_campaign'] = ft['utm_campaign'];
  }
  // GA4 excludes this with its own Internal traffic filter — no custom
  // JavaScript in the container, nothing to keep in step.
  if (res.locals['internal']) out['traffic_type'] = 'internal';
  return out;
}

/** `</script>` inside a JSON string would end the block early. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function trackingHead(res: Response, html: string, status: number): string {
  const consent =
    `<script>window.dataLayer=window.dataLayer||[];` +
    `function gtag(){dataLayer.push(arguments)}` +
    `gtag('consent','default',{` +
    `'ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied',` +
    `'analytics_storage':'denied','functionality_storage':'denied',` +
    `'personalization_storage':'denied','security_storage':'granted',` +
    `'wait_for_update':500});` +
    // Ads without cookies until consent arrives, and the click id carried in
    // the URL instead of a cookie so a conversion is still attributable.
    `gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);</script>`;

  const metadata = `<script>dataLayer.push(${inlineJson(pageMetadata(res, html, status))});</script>`;

  if (!GTM_ID) return consent + metadata;

  // Custom HTML tags are how a container turns into an injection point. The
  // policy blocks them in the browser; this blocks them in the container.
  const blocklist = `<script>dataLayer.push({'gtm.blocklist':['customScripts']});</script>`;

  const env = GTM_ENV_PARAMS ? `+'&${GTM_ENV_PARAMS}'` : '';
  const loader =
    `<script>(function(w,d,s,l,i){w[l]=w[l]||[];` +
    `w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});` +
    `var f=d.getElementsByTagName(s)[0],j=d.createElement(s),` +
    `dl=l!='dataLayer'?'&l='+l:'';j.async=true;` +
    `j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl${env};` +
    // The container loads its own tags; without this they inherit no nonce
    // and the policy rejects every one of them.
    `j.setAttribute('nonce','{{CSP_NONCE}}');` +
    `f.parentNode.insertBefore(j,f);` +
    `})(window,document,'script','dataLayer','${GTM_ID}');</script>`;

  return consent + metadata + blocklist + loader;
}

/**
 * The first touch, handed to the browser so a submission can carry it.
 *
 * The capture lives in an HttpOnly cookie, which is what makes it survive —
 * Safari caps script-written cookies at seven days and most patients convert
 * later than that. But HttpOnly also means the app cannot read it, and the
 * form posts to the API from the browser. Without this the click id reaches
 * our server and stops there: the lead is stored with no `gclid`, and the
 * weekly upload back to Google Ads has nothing to match a click on.
 *
 * A JSON island rather than a global: nothing is executed, and the value
 * cannot escape into the surrounding script.
 */
function firstTouchIsland(res: Response): string {
  const ft = res.locals['ft'] as Record<string, unknown> | null;
  if (!ft) return '';
  return `<script type="application/json" id="hayai-ft">${inlineJson(ft)}</script>`;
}

function trackingBody(res: Response): string {
  const island = firstTouchIsland(res);
  if (!GTM_ID) return island;
  const env = GTM_ENV_PARAMS ? `&amp;${GTM_ENV_PARAMS}` : '';
  return (
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}${env}"` +
    ` height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` +
    island
  );
}

/**
 * The tracking spec requires every inline script to carry a nonce, so the
 * policy can allow exactly what this server rendered and nothing a tag
 * manager, an injected extension or a stored-XSS payload adds later.
 *
 * Three things need stamping: the inline scripts and styles Angular emits
 * (hydration state, critical CSS), `ngCspNonce` so Angular reuses the same
 * nonce for styles it injects in the browser, and the `{{CSP_NONCE}}`
 * placeholder the spec's consent and container blocks will use.
 */
function withNonce(html: string, nonce: string): string {
  return html
    .replaceAll('{{CSP_NONCE}}', nonce)
    .replace(/<style(?![^>]*\bnonce=)/g, `<style nonce="${nonce}"`)
    .replace(/<script(?![^>]*\b(?:src|nonce)=)/g, `<script nonce="${nonce}"`)
    .replace(/<app-root(?![^>]*\bngCspNonce=)/g, `<app-root ngCspNonce="${nonce}"`);
}

/**
 * Report-Only for now, deliberately. The spec asks for a week of violation
 * reports before enforcing, because Google adds regional ad domains without
 * warning and a missing host under enforcement is a blank page rather than a
 * line in a log. Switch the header name to `Content-Security-Policy` once the
 * reports are quiet.
 */
function contentSecurityPolicy(nonce: string): string {
  const google = 'https://www.googletagmanager.com https://*.googletagmanager.com';
  // The chosen CMP. Its banner has to load before anything it gates, so a
  // policy that blocked it would leave the whole site measuring nothing.
  const cookieyes = 'https://cdn-cookieyes.com https://*.cookieyes.com';
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${google} https://www.google-analytics.com ` +
      `https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.com ` +
      `https://*.clarity.ms ${cookieyes}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https: https://*.google-analytics.com ${google} ` +
      `https://googleads.g.doubleclick.net https://www.google.com https://www.google.com.eg https://*.clarity.ms`,
    `connect-src 'self' ${API_BASE_URL} https://*.google-analytics.com https://*.analytics.google.com ` +
      `https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com ` +
      `https://www.google.com.eg https://pagead2.googlesyndication.com https://*.clarity.ms ${cookieyes}`,
    `frame-src 'self' https://www.googletagmanager.com https://td.doubleclick.net`,
    `upgrade-insecure-requests`
  ].join('; ');
}

/**
 * The last word on errors. Express's built-in handler prints the stack trace
 * into the response unless `NODE_ENV=production`, which makes "did someone
 * remember an environment variable" the thing standing between a crash and
 * our source code on a public page. It should not be. This answers a plain
 * 500 whatever the environment, and the detail goes to the log where it
 * belongs.
 */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).type('text/plain').send('Internal Server Error');
});

/**
 * Start the server if this module is the main entry point, or it is run via PM2.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, error => {
    if (error) {
      throw error;
    }
    console.log(`HAYAI web server listening on http://localhost:${port} (API ${API_BASE_URL})`);
    void checkSiteOrigin();
  });
}

/**
 * Canonicals, hreflang, sitemap URLs and JSON-LD `@id`s are all built by the
 * API from its own `base_url` setting, not by this server. If that setting
 * points at a different domain than the one this server answers on, every
 * page tells Google and AI crawlers that the real copy lives elsewhere — the
 * tags are present and look fine, only the host is wrong. Shout about it at
 * startup instead of finding out from Search Console weeks later.
 */
async function checkSiteOrigin(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/en/site`, {
      headers: { Accept: 'application/json', ...(WEBSITE_KEY ? { 'X-Website-Key': WEBSITE_KEY } : {}) }
    });
    const baseUrl: string | undefined = (await res.json())?.data?.base_url;
    if (!baseUrl) return;
    if (new URL(baseUrl).origin !== new URL(SITE_URL).origin) {
      console.warn(
        `[seo] WARNING: the API builds canonical/hreflang/sitemap URLs on ${new URL(baseUrl).origin}, ` +
        `but this site is SITE_URL=${new URL(SITE_URL).origin}. Fix the API's site URL setting (or SITE_URL) ` +
        `before launch — otherwise every page canonicalises to the wrong domain.`
      );
    }
  } catch (err) {
    console.warn(`[seo] Could not verify the API base_url against SITE_URL: ${(err as Error).message}`);
  }
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);
