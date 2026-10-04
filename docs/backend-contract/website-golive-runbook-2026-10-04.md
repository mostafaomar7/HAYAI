# Website go-live: the complete runbook (2026-10-04)

This closes the hosting question. **The decisions are made — nothing here is
waiting on an answer from us.** Work top to bottom; the only thing that comes
back to the owner is one IP address, in step 8.

Your two contract questions are answered with measurements in
[`docs/website-ssr-deployment.md` §5b](../website-ssr-deployment.md). Short
version: the real HTTP status is already sent (404 on unknown URLs, 301/302 on
CMS redirects, 503 + `Retry-After` on an unreachable listing), and the
crawler-hit payload already matches your schema, batched at most 50 rows
against your limit of 200. Neither needs anything from you.

---

## Decision: Huawei, next to Laravel, with Cloudflare in front

Your recommendation, with Cloudflare added to cover the bandwidth you measured.

Why this and not the alternatives:

- **Not Hostinger Node hosting.** Every rendered page makes an API call. On a
  separate host that call crosses the internet on every single page view.
  Next to Laravel it is a loopback call.
- **Cloudflare is not optional at ~2 Mbit/s.** The JS and CSS bundles are the
  bulk of the bytes and they are immutable and hash-named, so Cloudflare serves
  them from its edge and that bandwidth stops mattering for them. The HTML
  itself is small and comes from the server. Without Cloudflare, Largest
  Contentful Paint will not meet the 2.5 s budget the client's spec sets, no
  matter what we do in the code.
- Raise the Huawei bandwidth anyway if you can. Cloudflare covers the static
  files, not the first byte of the page.

**Cloudflare comes after go-live, not with it.** Nothing in the steps below
touches it. Go live with the A records pointing straight at the server,
confirm the acceptance list passes, and only then move the nameservers — two
changes at once means a failure has two possible causes.

Supervisor over PM2, as you proposed — it is already there, deploy can restart
it without root, and a second process manager buys nothing. The doc now
documents Supervisor as the default.

---

## 1. The build

A `.tar.gz` of `dist/BAREEQ/` is attached, or ask the owner for read access to the
website repo and run `npm ci && npx ng build` yourself — access is better,
because every release otherwise becomes a manual file transfer.

It contains two folders that **must stay next to each other**:

```
browser/   static files (JS, CSS, images) — ~5 MB
server/    server.mjs and its chunks      — ~4.8 MB
```

`server.mjs` resolves the static files as `../browser` relative to its own
directory. `server.mjs` on its own does nothing.

```bash
sudo mkdir -p /var/www/hayai-web
sudo tar -xzf hayai-web-<sha>.tar.gz -C /var/www/hayai-web
sudo chown -R www-data:www-data /var/www/hayai-web
```

## 2. Node 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # expect v22.x
```

Node 20 is end of life, so 22 is the one to install. The server needs 20 or newer either way: it uses `fetch`, `AbortSignal.timeout` and
`import.meta.dirname`.

## 3. `WEBSITE_SERVER_KEY` — please generate and set it, do not wait for a reply

**The owner has approved this.** Nothing here touches site content or user
data; it only creates a shared secret between Laravel and the Node server.

```bash
openssl rand -hex 32
```

Put the same value in all three places:

1. `/var/www/hayai-api/.env`
2. `/root/hayai-prod.env` (because `build-env.sh` rebuilds `.env` from it, and
   a key only in `.env` disappears on the next deploy)
3. the Supervisor program in step 4

Then:

```bash
php artisan config:cache
sudo systemctl reload php8.x-fpm
```

If this is skipped nothing errors — the whole website is rate-limited as one
visitor at 240/min, and every crawler-hit report is rejected, so the
dashboard's **Website → Crawlers** screen stays empty forever. That is why it
is worth doing before the DNS moves rather than after.

## 4. Supervisor

```ini
; /etc/supervisor/conf.d/hayai-web.conf
[program:hayai-web]
command=/usr/bin/node /var/www/hayai-web/server/server.mjs
directory=/var/www/hayai-web
environment=NODE_ENV="production",PORT="4000",API_BASE_URL="https://api.hayaihealthcare.com/api/v1",SITE_URL="https://hayaihealthcare.com",WEBSITE_SERVER_KEY="<the key from step 3>"
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
stdout_logfile=/var/log/hayai-web.log
redirect_stderr=true
```

```bash
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status hayai-web
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en   # expect 200
```

`NODE_ENV=production` matters: without it Express's built-in error handler
writes the stack trace into the response. The build now also installs its own
error handler that answers a plain 500 in every environment, so a forgotten
variable is no longer the thing standing between a crash and our source code
— but set it anyway, it also turns off Express's development-mode work on
every request.

Port 4000 stays closed in the firewall, as you said — nginx reaches it on the
loopback.

**Check the startup log once:**

```bash
grep '\[seo\]' /var/log/hayai-web.log
```

Silence is correct. A `[seo] WARNING` means the API's `base_url` and `SITE_URL`
disagree, which would canonicalise every page to the wrong domain. You already
confirmed `base_url` is `https://hayaihealthcare.com`, so this should be quiet.

## 5. Keep the API call on the loopback

```
# /etc/hosts
127.0.0.1 api.hayaihealthcare.com
```

Every rendered page makes at least one API call. This removes a public round
trip from each one. Confirm nginx still serves the API vhost on that name
locally; if it does not, set `API_BASE_URL` to the internal address instead.

## 6. nginx

```nginx
server {
  listen 443 ssl http2;
  server_name hayaihealthcare.com;

  # ssl_certificate … (step 7)

  access_log /var/log/nginx/hayai-web.access.log <the existing format that drops query strings>;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_read_timeout 60s;
  }
}

server {
  listen 443 ssl http2;
  server_name www.hayaihealthcare.com;
  return 301 https://hayaihealthcare.com$request_uri;
}

server {
  listen 80;
  server_name hayaihealthcare.com www.hayaihealthcare.com;
  return 301 https://hayaihealthcare.com$request_uri;
}
```

Three things that matter:

- **Keep `Host`.** The server refuses to render an unknown host (Angular's SSRF
  protection). A rewritten `Host` produces a blank page, not an error.
- **`www` → apex, one canonical origin.** The API builds every canonical,
  hreflang and sitemap URL on the bare host.
- **Use your existing log format that drops query strings.** `/en/search?q=`
  carries what people typed, which is often a condition or a medicine name.

## 7. HTTPS

```bash
sudo certbot certonly --dns-<provider> \
  -d hayaihealthcare.com -d www.hayaihealthcare.com
```

Use the **DNS challenge**, as you suggested. With the HTTP challenge the apex
fails for the few minutes between the DNS move and the certificate being
issued, and that window is exactly when someone will open the site.

## 8. Send the owner one line

> The A record for `hayaihealthcare.com` and `www` should point to `<IP>`.

That is the only thing that comes back. Please send it as soon as step 6 is in
place, so the DNS and the certificate can be done in the same sitting.

## 9. DNS (owner, in hPanel)

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | the IP from step 8 | 300 |
| A | `www` | the same IP | 300 |

Leave `api.hayaihealthcare.com` exactly as it is. Drop the TTL to 300 a few
hours beforehand if you can, so a mistake is five minutes to undo rather than a
day.

Nothing is deleted on Hostinger. `public_html` simply stops being reached and
is the rollback: put the old A record back and the current site returns.

## 10. Acceptance — run these and paste the output

```bash
S=https://hayaihealthcare.com

# 1. Server-rendered, not a shell. Expect >100 KB and an <h1> in the HTML.
curl -s $S/en | wc -c
curl -s $S/en | grep -o '<h1[^>]*>[^<]*' | head -1

# 2. Every URL is its own page (the bug today: one 21300-byte file for all).
for u in /en /ar /en/products /en/faq; do printf '%-16s ' $u; curl -s $S$u | wc -c; done

# 3. Structured data reaches crawlers.
curl -s $S/en | grep -c 'application/ld+json'          # expect 1
curl -s $S/en/doctors | grep -o '"@type":"CollectionPage"'

# 4. Real status codes.
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist   # 404
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $S/              # 302 → /en

# 5. Crawler files come from the CMS, not the SPA shell.
curl -s $S/robots.txt | head -3
curl -s $S/llms.txt   | head -3
curl -s $S/sitemap_index.xml | head -3

# 6. The key works end to end — this is the one we could not test without it.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://api.hayaihealthcare.com/api/v1/public/crawler-hits \
  -H 'Content-Type: application/json' -H "X-Website-Key: $KEY" \
  -d '{"hits":[{"user_agent":"Mozilla/5.0 (compatible; Googlebot/2.1)","path":"/en","resource":"page","count":1}]}'
# expect 202. A 403 means the key does not match between the two sides.

# 7. The dashboard still works and is not indexable.
curl -s -o /dev/null -w '%{http_code}\n' $S/login
curl -sI $S/dashboard | grep -i x-robots-tag        # noindex
```

The full acceptance list from the client's SEO spec is §9 of
[`docs/website-ssr-deployment.md`](../website-ssr-deployment.md).

## 11. Every release after this one

```bash
sudo tar -xzf hayai-web-<sha>.tar.gz -C /var/www/hayai-web
sudo chown -R www-data:www-data /var/www/hayai-web
sudo supervisorctl restart hayai-web
```

Roughly two seconds of downtime. If that is too much later on, deploy into a
dated directory and swap a symlink — but it is not worth doing now.

With repo access this becomes a deploy script instead of a file transfer, which
is the reason to ask for it.
