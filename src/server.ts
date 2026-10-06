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

/** The CMP's own cookie, and the value that means storage was allowed. */
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
      const body = withNonce(await response.text(), nonce);
      res.status(response.status);
      response.headers.forEach((v, k) => {
        if (k.toLowerCase() !== 'content-length') res.setHeader(k, v);
      });
      res.setHeader('Content-Security-Policy-Report-Only', contentSecurityPolicy(nonce));
      return res.send(body);
    })
    .catch(next);
});

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
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${google} https://www.google-analytics.com ` +
      `https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.com https://*.clarity.ms`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https: https://*.google-analytics.com ${google} ` +
      `https://googleads.g.doubleclick.net https://www.google.com https://www.google.com.eg https://*.clarity.ms`,
    `connect-src 'self' ${API_BASE_URL} https://*.google-analytics.com https://*.analytics.google.com ` +
      `https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com ` +
      `https://www.google.com.eg https://pagead2.googlesyndication.com https://*.clarity.ms`,
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
