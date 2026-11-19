# Backend: Arabic as the default language, and keep the API out of Google

Two small changes from the marketing team's SEO work orders (T03, X19). The web
server side is done: `/` now sends crawlers and Arabic browsers to `/ar`, and
unknown paths return 404 after checking `GET /public/redirects/resolve`.

## 1. Make Arabic the default locale (T03)

Today, checked on 2026-11-19:

- `GET /api/v1/public/ar/site` returns `default_locale: "en"`, and `locales[]`
  has `is_default: true` on `en`.
- Every page's `seo.alternates` from `GET /public/{locale}/resolve` has
  `x-default` pointing at the English URL.
- `/sitemap-ar.xml` and `/sitemap-en.xml` print
  `<xhtml:link hreflang="x-default" href="https://hayaihealthcare.com/en…">`.

Change: the default locale becomes `ar`, so:

- `default_locale: "ar"` and `is_default: true` on `ar` in `/public/{locale}/site`.
- `x-default` in `seo.alternates` points at the **Arabic** URL of the same page
  (for example `https://hayaihealthcare.com/ar/about-hayai`). On the home page,
  that is `https://hayaihealthcare.com/ar`.
- The same in both sitemaps' `hreflang="x-default"` entries.
- When a page has no Arabic version, keep `x-default` on the version that exists.

If this is a setting (site settings → default locale), changing the setting is
enough. If it is hard-coded, please make it a setting.

**Done when**

```bash
curl -s https://hayaihealthcare.com/en | grep -o 'hreflang="x-default"[^>]*'
# → href="https://hayaihealthcare.com/ar"
curl -s https://hayaihealthcare.com/sitemap-en.xml | grep -o 'x-default[^>]*' | head -2
# → both /ar/…
```

## 2. `X-Robots-Tag` on every API response (X19)

Search Console lists 6 `api.hayaihealthcare.com` URLs (JSON responses and
`/privacy`). The API host sends no `X-Robots-Tag`.

Change: in the nginx server block for `api.hayaihealthcare.com`:

```nginx
add_header X-Robots-Tag "noindex, nofollow" always;
```

`always` matters: without it nginx drops the header on 4xx/5xx. Note that an
`add_header` inside a `location` block replaces the ones from the server block,
so add it to any `location` that has its own `add_header` lines too.

Do **not** block the API in `robots.txt`: Google has to fetch a URL to see the
`noindex` and drop it.

If an API page is meant to be public (for example `/privacy`, linked from the
app stores), it can stay reachable, but its public copy belongs on the website
(`/ar/privacy`, `/en/privacy`).

**Done when**

```bash
curl -sI https://api.hayaihealthcare.com/robots.txt | grep -i x-robots-tag
curl -sI https://api.hayaihealthcare.com/api/v1/does-not-exist | grep -i x-robots-tag
# both → X-Robots-Tag: noindex, nofollow
```
