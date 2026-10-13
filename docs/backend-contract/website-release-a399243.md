# Website release `a399243` — deploy guide (2026-10-13)

**Deploy this one.** Creating an advertisement from the dashboard is broken on
production right now and this release is the fix. Nothing on the API side needs
to change for it; the break is entirely ours.

Same package shape as before, **no environment changes**: replace the two
folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-a399243.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      a399243f43a52e6a3bd8d4097faa2c6e7cc9b14c
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-a399243.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree — file names are hashed per build, so
the old ones pile up forever. `rm -rf` on the two folders first is the one step
that is not optional.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
`chown`, restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}
' http://127.0.0.1:4000/en         # 200
cat /var/www/hayai-web/RELEASE                                             # a399243…
```

**New in this release — the translation dictionaries are now cached for a
year.** The server hashes them at startup and stamps the hash into every page;
a request carrying the current hash is cached, one carrying anything else is
not. Both halves must be true:

```bash
# the page carries a real hash, not the literal placeholder
curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

V=$(curl -s $S/login | grep -o 'content="[0-9a-f]*"' | head -1 | cut -d'"' -f2)

curl -sI "$S/assets/i18n/en.json?v=$V"      | grep -i cache-control
#   Cache-Control: public, max-age=31536000, immutable

curl -sI "$S/assets/i18n/en.json?v=wrong"   | grep -i cache-control
#   Cache-Control: no-cache
```

If the second one ever answers `max-age=31536000`, stop and tell us: it would
mean a stale dictionary could be pinned in browsers for a year.

The rest is unchanged and should still hold:

```bash
curl -sI $S/ar | grep -o "style-src[^;]*"            # has 'unsafe-inline', no nonce
curl -sI $S/login | grep -o "script-src [^;]*"       # has 'nonce-…'
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l       # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l    # 0
curl -s -o /dev/null -w '%{http_code}
' $S/en/this-page-does-not-exist   # 404

# no unsubstituted placeholder reached the browser, on any page
# (grep -c exits 1 when the count is 0 — that is the good outcome here)
for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

Then sign in and **create an advertisement**. That is the one thing to confirm
by hand: it fails on the version currently deployed.

## 4. What changed since `968c392`

16 commits. What a deployer needs to know:

**The urgent one.** The dashboard never sent `provider_type` when creating an
advertisement. When the API made that field required, every create from the
dashboard started failing with a 422 and nobody noticed until QA tried. Fixed;
`owner_id` and `provider_type` are now sent together.

**On the server process:**

- The i18n dictionaries are hashed at startup and served with a one-year cache
  under `?v=<hash>`, instead of being revalidated on every page load. Measured:
  52 KB on a first load, then 0 bytes. See the check in section 3.
- The client shell was printing `{{TRACKING_HEAD}}` and `{{TRACKING_BODY}}` as
  visible text on any URL that fell through to it. Stripped.
- No new environment variable. `AUTH_MODE`, `CSP_REPORT_ONLY` and
  `HSTS_INCLUDE_SUBDOMAINS` are unchanged and should stay as they are.

**In the dashboard** (no server impact, listed so you know what QA will see):

- The audit log shows what actually changed — before and after per field, and
  a readable action name. The API has been sending `old_values`/`new_values`
  all along and this screen was discarding them.
- `/dashboard/notfication` was misspelled in the route; the correct spelling
  now serves it and the old one redirects. Same for the two device routes,
  which said `external` while their heading said Internal.
- The browser tab is named per page, the top bar is sticky, the logo links
  home, and the duplicate "Audit log" menu entry is gone.
- Advertisements: cards show the owner, the type and whether the advert is
  running, expired or scheduled; a delete names what it is deleting.
- Website CMS: a duplicate category slug is caught before the API answers 500,
  the form-key hint matches what the API actually accepts, a CTA saves with no
  placement, and a setting published on the site is checked for format —
  `bad-email` can no longer be saved as the public contact address.
- Charitable organisations, settings, profile: weekday schedules start closed
  rather than enabled-with-no-hours, the app-version switches have real
  controls, and a picked avatar is shrunk in the browser before upload.

**Still open on the API**, unchanged by this deploy:
[`api-open-items-2026-10-13.md`](api-open-items-2026-10-13.md) — eight items,
the first of which may mean five finished advertisements are still being
served to the apps.
