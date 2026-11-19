# Website release `29bfa2d` — deploy guide (2026-11-19)

Follows `09291e6`. Same package shape, **no environment change**: replace the
two folders and restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**This release needs nothing new from the backend.** Every endpoint it calls
answered on production on 2026-11-19: `/admin/loyalty/*`,
`/admin/analytics/app-usage` and `/users`, `meta.user.app_usage`, and
`/public/redirects/resolve`.

**Read before deploying:** the public site now sends `/` to **`/ar`** for
crawlers and Arabic/unknown browsers (it used to be `/en`), and any address
outside `/ar`, `/en`, `/login` and `/dashboard` now answers a real **404**
(or the CMS redirect for it) instead of a 200 admin page. See section 4.

---

## 1. The package

`hayai-web-29bfa2d.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      29bfa2d…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-29bfa2d.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree: file names are hashed per build, so
the `rm -rf` of the two folders first is not optional. The restart is
required: the redirect and 404 behaviour lives in `server.mjs`.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/ar     # 200
cat /var/www/hayai-web/RELEASE                                       # 29bfa2d…

curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $S/                       # 302 …/ar
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Accept-Language: en' $S/   # 302 …/en
curl -s -o /dev/null -w '%{http_code}\n' $S/this-does-not-exist                    # 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $S/sitemap.xml            # 301 …/sitemap_index.xml
for u in /login /dashboard /ar /en; do curl -s -o /dev/null -w "$u %{http_code}\n" $S$u; done   # all 200

curl -s "$S/assets/i18n/ar.json" | grep -c '"menu.loyalty"'      # 1
curl -s "$S/assets/i18n/ar.json" | grep -c '"menu.app_usage"'    # 1
for u in / /ar /login /dashboard; do curl -sL "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

If `/this-does-not-exist` still answers `200`, nginx is serving its own
fallback for unknown paths instead of passing them to Node; it must proxy
everything to port 4000.

**Click checks (dashboard, as super-admin):**

- Sidebar → **نقاط حياي**: six screens open with real data (overview,
  rules, partners, members, vouchers, settings). The program is **off**
  on the server; switching it on is a business decision, not part of the
  deploy.
- Sidebar → **استخدام التطبيق**: the cards, bars and tables load; a bar opens
  the users list; a user opens their activity page, which now has an
  **App** card.
- **Renewal users**: each row shows its phase and days left; "Renew all"
  renews only the filtered rows.

## 4. What changed since `09291e6`

Four code commits.

- **`3f71802` Hayai points** (new section, area `loyalty`): overview,
  settings, earning rules and campaigns, partners, members' points with
  manual adjustment, vouchers and settlement. Patients and tourists get a
  "Hayai points" item in their row menu.
- **`595f717` App usage** (area `statistics`): who uses the apps, on which
  platform / store and version, who stopped, and an App card on each user's
  activity page.
- **`b686ba6` Public site / SEO**:
  - `/` → `/ar` unless the browser's first language is English.
  - Off-locale paths: CMS redirect (real 301/302, cached 60 s) or a plain
    `noindex` 404 page; `503` if the API is down. They used to get the admin
    shell with a 200, which Google counts as a soft 404.
  - Google Play / App Store buttons carry the visit's utm campaign.
  - The backend half (Arabic `x-default`, `X-Robots-Tag` on the API) is in
    `seo-arabic-default-and-api-noindex-2026-11-19.md`; it is independent of
    this deploy.
- **`29bfa2d` Renewal users**: phases with grace period, days left,
  "Renew all" keeps the list's filters, deleted accounts or plans no longer
  break a row.

Tested before packaging against production (reads only, every write blocked):
every route above answered as listed in section 3, and the dashboard screens
loaded real data with no API or page errors.
