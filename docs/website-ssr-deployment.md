# HAYAI website — server-side rendering (SSR) deployment

This app now contains two things that are deployed together:

1. **The public website** (`https://hayaihealthcare.com/en/...`, `https://hayaihealthcare.com/ar/...`).
   It is **rendered on the server** (Angular SSR). Google, Bing and the AI crawlers
   (GPTBot, ClaudeBot, PerplexityBot, …) do not run JavaScript reliably, so the server
   must send the complete page — H1, price, coverage text, FAQ, JSON-LD — in the first
   HTML response.
2. **The admin dashboard** (`/dashboard`, `/login`). It is still a normal browser app
   (client-side rendering). It is served by the same Node server.

---

## 0. For the backend / server team: what this Node server is

**Nothing changes in Laravel.** `api.hayaihealthcare.com` keeps running exactly as today.
What changes is how the *frontend* is hosted: it is no longer only static files, it is a
small long-running Node.js web server (`dist/BAREEQ/server/server.mjs`, built with
Express + Angular SSR). It plays the role that `php-fpm` plays for Laravel: something
must keep it running and nginx must forward requests to it.

```
browser / Googlebot / GPTBot
        │  https://hayaihealthcare.com/en/products/x
        ▼
     nginx (HTTPS) ──proxy──►  Node server.mjs  (port 4000, PM2 keeps it alive)
                                   │  1. GET /api/v1/public/en/resolve?path=products/x
                                   │     (+ header X-Website-Key: WEBSITE_SERVER_KEY)
                                   ▼
                          Laravel  api.hayaihealthcare.com
                                   │  JSON (page, product, SEO, schema)
                                   ▼
                          server.mjs builds the full HTML page and returns it
```

What `server.mjs` does, request by request:

| Request | What the server does |
|---|---|
| `/en/...`, `/ar/...` (public website) | Calls the public API (`/public/{locale}/resolve`, `/public/{locale}/site`), renders the Angular page **to complete HTML** (H1, prices, FAQ, JSON-LD, canonical, hreflang) and sends it. Real HTTP status: `200`, `301/302` for CMS redirects, `404` for unknown paths. Keeps API answers in memory for 30–60 s. |
| `/robots.txt`, `/llms.txt`, `/sitemap_index.xml`, `/sitemap-*.xml` | **Proxies** them from `GET /api/v1/public/{file}` (they are edited in the dashboard). If the API is down it answers `503 Retry-After`, never `404` (a 404 robots.txt means "crawl everything"). |
| `/dashboard...`, `/login` | Sends the normal browser app (not server-rendered, the admin token lives in the browser). Adds `X-Robots-Tag: noindex`. All dashboard API calls still go from the browser straight to Laravel, as today. |
| `/` | `302` to `/en` (or `/ar` if the browser's first language is Arabic). |
| JS / CSS / images | Static files from `dist/BAREEQ/browser`, with long cache headers for hashed files. |
| Any request from a known crawler (Googlebot, GPTBot, ClaudeBot, PerplexityBot, …) | Counted in memory and sent in batches (every 60 s or 50 hits) to `POST /api/v1/public/crawler-hits` with `X-Website-Key`. This feeds **Website → Crawlers** in the dashboard. Never slows the response. |
| At startup | Reads `base_url` from `/public/en/site` and logs a `[seo] WARNING` if it differs from `SITE_URL` (wrong canonical domain). |

What the backend team needs to provide or check:

1. **A place to run Node 20+** (same VPS as Laravel is the simplest), PM2, and an nginx
   `server` block for `hayaihealthcare.com` → `127.0.0.1:4000` (section 5).
2. **`WEBSITE_SERVER_KEY`** as an environment variable of the Node process (section 4).
   Without it the API rate-limits the whole website as one IP and rejects crawler-hit reports.
3. The API keeps CORS open for `https://hayaihealthcare.com` (the browser still calls the
   API for forms, purchases, analytics events and the dashboard).
4. DNS: `hayaihealthcare.com` and `www.hayaihealthcare.com` → the server running nginx;
   `api.hayaihealthcare.com` unchanged.

---

## 1. Why the current hosting is not enough

The current Hostinger plan serves static files through Apache (`public/.htaccess` rewrites
every URL to `index.html`). Static hosting **cannot run SSR**: it can only send the
empty `index.html`, which is fine for the dashboard but gives crawlers an empty page.

The website needs a host that can run **Node.js 20 or newer** as a long-running process:
a VPS (Hostinger VPS, DigitalOcean, Hetzner, AWS Lightsail…), Hostinger "Node.js
hosting", Render, Railway, Fly.io, or a container platform.

> The old static upload still works for the dashboard only. Do not point `hayaihealthcare.com`
> at it once the website is live — crawlers would get empty pages.

---

## 2. Build

```bash
npm ci
npx ng build            # production build (default configuration)
```

Output in `dist/BAREEQ/`:

| Folder | What |
|---|---|
| `dist/BAREEQ/browser/` | static files (JS, CSS, images, `index.csr.html`) |
| `dist/BAREEQ/server/`  | the Node server (`server.mjs`) and the SSR bundle |

Copy the **whole `dist/BAREEQ/` folder** plus `package.json` / `package-lock.json` to the
server. The server bundle includes its dependencies, but running `npm ci --omit=dev`
on the server is the safest option.

## 3. Start

```bash
node dist/BAREEQ/server/server.mjs
# or: npm run serve:ssr:BAREEQ
```

Keep it running with a process manager, e.g. PM2:

```bash
pm2 start dist/BAREEQ/server/server.mjs --name hayai-web
pm2 save
```

## 4. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | Port the Node server listens on. |
| `API_BASE_URL` | `https://api.hayaihealthcare.com/api/v1` | Laravel API used **by the server**. May be an internal address of the same API (faster), but must end in `/api/v1`. Browsers always use the URL in `src/environments/environment.prod.ts`. |
| `WEBSITE_SERVER_KEY` | — | Sent as `X-Website-Key` on every server→API call so the API does not rate-limit the whole website as one IP, and required for crawler-hit reporting. **Never** exposed to browsers. Ask the backend team for the value. |
| `SITE_URL` | `https://hayaihealthcare.com` | Public origin. Its host (with and without `www.`) is allowed to be server-rendered. |
| `NG_ALLOWED_HOSTS` | — | Extra host names allowed to be rendered, comma separated (e.g. a staging domain). Requests with any other `Host` header are refused (Angular SSRF protection). |

## 5. Reverse proxy, HTTPS and CDN

Put Nginx (or Caddy, or the platform's load balancer) in front of Node for HTTPS:

```nginx
server {
  server_name hayaihealthcare.com;
  listen 443 ssl http2;
  # ssl_certificate … (Let's Encrypt / certbot)

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
server { listen 443 ssl http2; server_name www.hayaihealthcare.com; return 301 https://hayaihealthcare.com$request_uri; }
server { listen 80; server_name hayaihealthcare.com www.hayaihealthcare.com; return 301 https://hayaihealthcare.com$request_uri; }
```

- Keep the `Host` header (the server only renders allowed hosts).
- Redirect `http://` and `www.` to `https://hayaihealthcare.com` (one canonical origin; do not hardcode `www` anywhere).
- A CDN (Cloudflare etc.) in front is recommended: it respects the cache headers below.

## 6. Cache headers sent by the server

| Path | Cache-Control |
|---|---|
| Hashed JS/CSS (`main-XXXX.js`, `chunk-XXXX.js`, `styles-XXXX.css`) | `public, max-age=31536000, immutable` |
| Other static files (logo, favicon) | `public, max-age=86400` |
| `assets/i18n/*.json` (dashboard dictionaries) | `no-cache` |
| Website pages `/en/…`, `/ar/…` | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` (browsers revalidate, a CDN may keep 60 s) |
| `/robots.txt`, `/llms.txt`, `/sitemap_index.xml`, `/sitemap-*.xml` | `public, max-age=300` (proxied from the CMS) |
| `/preview?token=…`, `/{locale}/requests/track` | `no-store` |
| `/dashboard…`, `/login` | `no-cache` + `X-Robots-Tag: noindex, nofollow` |

The server also keeps API answers in memory for a short time (site menus 60 s, pages 30 s)
to keep the time-to-first-byte low. After publishing in the dashboard, a change is
visible within about one minute.

## 7. How the URLs work

| URL | What happens |
|---|---|
| `/` | `302` to `/en` (or `/ar` when the browser's first language is Arabic). `x-default` stays English. |
| `/en/...`, `/ar/...` | Server-rendered. One API call (`/public/{locale}/resolve`) decides: page, product, author, listing, redirect (real `301/302`), or not found (real `404`). |
| `/en/products?page=2` | Listing pages; canonical/robots come from the API. |
| `/en/search?q=…` | Search, always `noindex`. |
| `/preview?token=…&locale=en` | Draft preview from the dashboard, `noindex`, never cached. |
| `/en/requests/track?ref=…&token=…` | Guest purchase tracking (`noindex`, disallowed in robots.txt). |
| `/robots.txt`, `/llms.txt`, `/sitemap_index.xml`, `/sitemap-en.xml`, `/sitemap-ar.xml` | Proxied from the CMS. Edit them in **Website → Sitemap / Robots / LLMs**. |
| `/dashboard`, `/login` | The admin app, as before, from the same server. |

## 8. Robots rules for the admin area

The server already sends `X-Robots-Tag: noindex, nofollow` on `/dashboard` and `/login`.
Also add them to robots.txt so crawlers do not waste time there:

**Dashboard → Website → Crawlers / Robots → group `*`** → add `Disallow: /dashboard` and
`Disallow: /login`.

## 9. Acceptance test (from the SEO spec)

After deploying, the important text must be in the raw HTML — no JavaScript involved:

```bash
# Price of a product page is in the HTML
curl -s https://hayaihealthcare.com/en/products/<product-slug> | grep -c "EGP 4,500"

# Coverage / body text of a page is in the HTML
curl -s https://hayaihealthcare.com/en/<page-path> | grep -c "<a sentence from the page>"

# Exactly one H1, the direct answer, one JSON-LD block
curl -s https://hayaihealthcare.com/en/<page-path> | grep -o "<h1" | wc -l              # 1
curl -s https://hayaihealthcare.com/en/<page-path> | grep -c 'data-geo="answer"'        # 1
curl -s https://hayaihealthcare.com/en/<page-path> | grep -c 'application/ld+json'      # 1

# Arabic is right-to-left
curl -s https://hayaihealthcare.com/ar | grep -o '<html[^>]*>'        # lang="ar" dir="rtl"

# Missing pages return a real 404
curl -s -o /dev/null -w "%{http_code}\n" https://hayaihealthcare.com/en/does-not-exist   # 404

# Crawler files
curl -sI https://hayaihealthcare.com/robots.txt
curl -s https://hayaihealthcare.com/sitemap_index.xml

# The DOMAIN inside the tags, not just the tags. Canonical, hreflang, sitemap
# <loc> and JSON-LD URLs are built by the API from its own site-URL setting, so
# they can all be present and still point at the wrong host. Every line below
# must start with the live origin (e.g. https://hayaihealthcare.com) and nothing else.
curl -s https://hayaihealthcare.com/en/<page-path> | grep -oE '(rel="canonical"|hreflang="[^"]+") href="https?://[^/"]+' | sort -u
curl -s https://hayaihealthcare.com/en/<page-path> | grep -oE '"(@id|url)":"https?://[^/"]+' | sort -u
curl -s https://hayaihealthcare.com/sitemap_index.xml https://hayaihealthcare.com/sitemap-en.xml | grep -oE '<loc>https?://[^/<]+' | sort -u
```

The server also checks this at startup: if the API's `base_url` differs from `SITE_URL`,
it logs `[seo] WARNING: the API builds canonical/hreflang/sitemap URLs on …`.

Every count must be at least 1 (exactly 1 for H1 / JSON-LD). If a price grep returns `0`,
check that the product has `is_price_public` turned on and a `fixed` or `starting_from`
pricing type. Private prices are never printed.

## 10. Google Search Console verification

`index.html` contains the `google-site-verification` meta tag, and every server-rendered
page includes it. Because `/` now redirects to `/en`, if Search Console ever fails to
re-verify the meta tag on the bare domain, switch the property to **DNS (TXT record)**
verification, which does not depend on the home page.

## 11. Local check

```bash
npx ng build
PORT=4317 node dist/BAREEQ/server/server.mjs
curl -s http://localhost:4317/ar/products | grep -o '<html[^>]*>'
```

A development build (`npx ng build --configuration development`) also serves
`/en/__fixture`, a sample page with every block type, for checking the HTML. That page
does not exist in production builds.
