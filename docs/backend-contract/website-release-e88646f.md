# Website release `e88646f` — deploy guide (2026-11-05)

Follows `cc9e0dc`, which is **on the server**. We checked before building
this: the live `en.json` already carries `notif.send.only_registered`, which
is the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Deploy order: either way.** This goes with the Plans prompt of 2026-11-05,
whose backend half (the 15 tourist modules, and no Medical Tourism for
patients) is not on production yet. The dashboard already renders whatever
the modules endpoint returns, so this release is safe before or after it.

---

## 1. The package

`hayai-web-e88646f.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      e88646f…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-e88646f.tar.gz

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
cat /var/www/hayai-web/RELEASE                                       # e88646f…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

This release adds no strings, so no dictionary check applies.

**Click checks**, signed in as a super-admin: open **Plans → Tourist → Edit
modules**, then **Plans → Patient → Edit modules**. Each lists the plan's
modules as before (26 and 27 until the backend release, then 15 and 26).
Close without saving.

## 4. What changed since `cc9e0dc`

One code commit, `e88646f`.

The inline **Edit modules** popup built its rows and its save from the list's
copy of the plan, so a tab left open across a catalog change would show and
resend modules the server has removed. It now trims to
`/admin/subscription/plans/modules` when it opens, and saves only what it
shows.

On production today this changes nothing: all seven tourist and patient plans
match their catalogs exactly. We tested the trimming with a local mock API,
and compared the plans with the live API read-only.
