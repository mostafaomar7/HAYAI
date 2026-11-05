# Website release `d82d90a` — deploy guide (2026-11-05)

Follows `e88646f`, which is **on the server**. We checked before building
this: the live `/login` page loads `main-QCWCZ7F5.js`, which is that release's
bundle.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Deploy order: either way.** The setting `support.emails` is not on production
yet. Deployed before it, the page simply has no Support section; it appears by
itself when the backend adds the row. No second web deploy is needed.

---

## 1. The package

`hayai-web-d82d90a.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      d82d90a…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-d82d90a.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree. File names are hashed per build, so
the old ones pile up forever. Running `rm -rf` on the two folders first is not
optional.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w "%{http_code}
" http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # d82d90a…

curl -s $S/login | grep -o "<meta name=\"hayai-i18n-version\" content=\"[^\"]*\">"
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c "settings.email_list_hint"   # 1
curl -s "$S/assets/i18n/en.json" | grep -c "settings.email_list_hint"   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c "{{" || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin, on **Settings**:

- The page opens as before, with no error.
- Once the backend adds `support.emails`: a **Support** section at the end, with
  **Support email addresses**. Empty means the addresses set on the server.

## 4. What changed since `e88646f`

One code commit, `d82d90a`, from the dashboard prompt of 2026-11-05.

- Settings names the new `support` group and draws a wide box for
  `format: email_list`, saying that commas separate the addresses, the first
  is the main one, and empty uses the server's addresses.
- It sends text, or `null` when empty. A 422 shows under the setting and the
  edit stays in the box.

We tested the box against production with the row mocked, because it is not
live yet. Saves were blocked in the browser, so nothing was written.

The 17 tourist modules need no dashboard change. Production serves 15 today,
and the three Medical Tourism switches appear when the backend sends them.
