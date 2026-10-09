# Website release `c979a35` — deploy guide (2026-10-09)

The public website is **server-side rendered** now. It is a Node process, not a
folder of static files: uploading the build to Hostinger `public_html` (or any
static host) serves a blank shell to crawlers and breaks every page the SEO and
measurement specs depend on. It runs next to Laravel under Supervisor, with
nginx in front — the setup in
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

- **First time on the server:** do the runbook, steps 1–10, using this
  package in step 1 and the full variable list in section 2 below instead of
  the runbook's step 4 line.
- **Already running:** sections 1–4 below are the whole job.

---

## 1. The package

`hayai-web-c979a35.tar.gz` (also as `.zip`, same content):

```
hayai-web/
  browser/     static files (JS, CSS, fonts, images)
  server/      server.mjs and its chunks
  DEPLOY.md    this file
```

- **Self-contained.** No `npm install`, no `node_modules`: everything the server
  needs is bundled into `server/`. Checked by running it from an empty folder.
- **Node 20 or newer** (22 recommended, runbook step 2).
- `browser/` and `server/` **must stay side by side** — `server.mjs` finds the
  static files at `../browser`.

## 2. Environment variables — the complete list

They live in the Supervisor program, **not** in the package and not in any
file inside it. A redeploy never touches them.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | nginx proxies to `127.0.0.1:4000`; keep it closed in the firewall |
| `API_BASE_URL` | `https://api.hayaihealthcare.com/api/v1` | With the `/etc/hosts` loopback line from the runbook |
| `SITE_URL` | `https://hayaihealthcare.com` | Bare host, no `www` |
| `WEBSITE_SERVER_KEY` | the same value as Laravel's `.env` | Secret. Never in a repo, a chat or a ticket |
| `GTM_ID` | `GTM-5VKC5CMT` | **New in this release.** Without it no tag container is printed and nothing is measured |
| `CONSENT_COOKIE` | `cookieyes-consent` | **New.** The cookie banner's cookie |
| `CONSENT_GRANTED_PATTERN` | `advertisement:yes` | **New.** What that cookie contains once the visitor accepts |

**Do not set `GTM_ENV_PARAMS` on this server.** It switches the container to
the staging environment and belongs only on a separate staging host.

```ini
; /etc/supervisor/conf.d/hayai-web.conf
[program:hayai-web]
command=/usr/bin/node /var/www/hayai-web/server/server.mjs
directory=/var/www/hayai-web
environment=NODE_ENV="production",PORT="4000",API_BASE_URL="https://api.hayaihealthcare.com/api/v1",SITE_URL="https://hayaihealthcare.com",WEBSITE_SERVER_KEY="<same as Laravel>",GTM_ID="GTM-5VKC5CMT",CONSENT_COOKIE="cookieyes-consent",CONSENT_GRANTED_PATTERN="advertisement:yes"
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
stdout_logfile=/var/log/hayai-web.log
redirect_stderr=true
```

`environment=` is **one line**, comma-separated, values in double quotes.
After editing the file, Supervisor must re-read it — a plain `restart` keeps
the old variables:

```bash
sudo supervisorctl reread && sudo supervisorctl update
```

## 3. Deploy

```bash
# 1. Upload hayai-web-c979a35.tar.gz to the server (scp / sftp), then:
cd /tmp && tar -xzf hayai-web-c979a35.tar.gz          # → /tmp/hayai-web/

# 2. Replace the old build. Remove the old folders first: file names are
#    hashed per build, and extracting on top leaves the previous release's
#    files lying around forever.
sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo mkdir -p /var/www/hayai-web
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo chown -R www-data:www-data /var/www/hayai-web

# 3. Variables (only if section 2 changed anything), then restart.
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web                    # RUNNING
```

About two seconds of downtime during the restart.

**Rollback:** keep the previous package; extract it the same way and restart.

## 4. Check — paste the output back to us

```bash
S=https://hayaihealthcare.com

# Running, and on the new build
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en      # 200
tail -n 20 /var/log/hayai-web.log                                       # no errors; no "[seo] WARNING"

# The tag container is printed exactly twice (loader + noscript)
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l                          # 2

# The page classification comes before the container, with this release's keys
curl -s $S/ar | grep -o '"page_type":"[a-z_]*"'                         # "page_type":"home"

# Search text never reaches analytics
curl -sL "$S/en/search?q=test" | grep -o '"page_location":"[^"]*"'      # ends in /en/search, no ?q=

# Real status codes
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist # 404

# Dashboard still served
curl -s -o /dev/null -w '%{http_code}\n' $S/login                       # 200
```

If the `GTM-5VKC5CMT` count is `0`, the variables were not re-read: run
`reread && update`, then `restart`.

## What changed in this release (for your records)

- Tracking: page metadata (`page_type`, `page_language`, `care_category`,
  `page_location` without private parameters), search / no-results /
  form-error events, `event_id` and `form_id` on leads.
- WhatsApp reference codes: the site posts to your
  `POST /public/{locale}/whatsapp-refs` on every WhatsApp tap.
- Dashboard → Leads: WhatsApp code lookup and lead creation; Google Ads
  offline-upload download.
- No API change is required by this release; it uses `43ef6ed`.
