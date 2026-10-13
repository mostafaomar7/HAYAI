# Website release `968c392` — deploy guide (2026-10-13)

**Deploy this one sooner rather than later.** The cookie consent banner is
rendering with no styling on the live site, and this release is the fix.

Same package shape as before, **no environment changes**: replace the two
folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-968c392.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      968c392931168d2f2fad12674127092bd1c3804f
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-968c392.tar.gz

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

## 3. If you need the banner back before this deploy

One Supervisor line, no build:

```ini
CSP_REPORT_ONLY="1"
```

then `supervisorctl reread && supervisorctl update && supervisorctl restart hayai-web`.

That stops the content policy being enforced, which is what is stripping the
banner's styling. **Remove it again once this release is deployed** — it also
turns off the protection the policy is there for.

## 4. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en          # 200
cat /var/www/hayai-web/RELEASE                                              # 968c392…

# style-src must have 'unsafe-inline' and NO nonce — that is the fix
curl -sI $S/ar | grep -o "style-src[^;]*"
#   style-src 'self' 'unsafe-inline' https://fonts.googleapis.com …

# the dashboard's policy is stricter and must still have its nonce
curl -sI $S/login | grep -o "script-src [^;]*"
#   script-src 'self' 'nonce-…'

curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l                              # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l                           # 0
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist      # 404
```

Then open the site in a normal browser and confirm the cookie banner is a
styled bar at the bottom rather than plain text down the page.

## 5. What changed since `c979a35`

26 commits. The ones that matter on the server:

- **This fix.** `style-src` no longer carries a nonce, so a consent banner can
  inject its own stylesheet. `script-src` is untouched and still nonce-based.
- Content policy enforced rather than report-only, on the website and on the
  admin pages separately, plus `X-Frame-Options`, HSTS and `Permissions-Policy`.
- `AUTH_MODE` (default `bearer`) — the dashboard's session mode, for the
  HttpOnly-cookie work. **Leave it unset.**
- `CSP_REPORT_ONLY` and `HSTS_INCLUDE_SUBDOMAINS`, both off by default.
- Dashboard: account deletion, the deletion-requests inbox, doctor
  verification, external device orders, advertisement owner and link
  validation, duplicate names in the option lists, Arabic in two dropdowns.

No API change is required to deploy this.
