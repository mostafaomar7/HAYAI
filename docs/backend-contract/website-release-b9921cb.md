# Website release `b9921cb` — deploy guide (2026-11-01)

Follows `a1fb052`, which is **on the server**. We checked before building
this: the live `en.json` already carries `gorders.gallery_images`, which is
the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**This release needs no backend change.** The clinical guideline endpoints it
calls already answer on production.

---

## 1. The package

`hayai-web-b9921cb.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      b9921cb…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-b9921cb.tar.gz

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

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # b9921cb…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'guidelines\.subspecialty_none'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'guidelines\.subspecialty_none'   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin, under **Lists → Clinical
guidelines**:

- **Add guideline** has a **Specialty** field listing all specialties.
  Choosing *Critical Care Medicine* shows no subspecialty field. Choosing
  *Internal Medicine* shows a **Subspecialty** field that starts on
  **— None —**.
- The list has a **Specialty** filter. Choosing *Internal Medicine* adds a
  **Subspecialty** filter and lists Cardiology, Hematology and the rest.
- Editing an existing guideline opens on its own specialty and subspecialty.

## 4. What changed since `a1fb052`

One code commit, `b9921cb`, from the dashboard prompt of 2026-11-01.

- The category picker listed subspecialties only, so the 17 specialties that
  have none could not be chosen. The form now picks the specialty first, then
  an optional subspecialty.
- `specialty_id` and `subspecialty_id` are always sent, with `null` explicit
  (an empty string in multipart). Moving a guideline to another specialty
  therefore no longer 422s on its old subspecialty.
- The list filter works the same way: `specialty_id`, then optionally
  `subspecialty_id`.

We ran this build against production before packaging it. Saves were
intercepted in the browser, so nothing was written.
