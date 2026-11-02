# Website release `cc9e0dc` — deploy guide (2026-11-03)

Follows `a40a588`, which is **on the server**. We checked before building
this: the live `en.json` already carries `plans.tourist_only_hint`, which is
the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**This release needs no backend change.** It reads
`GET /admin/notifications/broadcast/doctor-specialties`, which already
answers 200 on production. We measured it before packaging. Had it been
missing, the picker falls back to the plain lists without counts.

---

## 1. The package

`hayai-web-cc9e0dc.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      cc9e0dc…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-cc9e0dc.tar.gz

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
cat /var/www/hayai-web/RELEASE                                       # cc9e0dc…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'notif\.send\.only_registered'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'notif\.send\.only_registered'   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin, on **Send notification →
Choose types → Doctors**. Do not press Send: the count bar is enough.

1. **"Only specialties doctors registered with"** is ticked, and the list
   shows the specialties that have doctors, each with its count (6 today).
2. Open **Internal Medicine** and tick only **Infectious Diseases**. The bar
   reads **Will reach 1 account**.
3. Tick **Internal Medicine** itself. The bar reads **2**, and its
   subspecialties show as ticked and greyed out.
4. Untick the toggle. All **29** specialties appear.

We ran these four against production from this exact build before
packaging. Nothing was sent.

## 4. What changed since `a40a588`

One code commit, `cc9e0dc`, from the dashboard prompt of 2026-11-02.

- The Doctors filter listed the 29 top-level specialties only, so doctors
  under a subspecialty could not be reached. It is now a two-level list from
  `/broadcast/doctor-specialties`, with doctor counts, the "only registered"
  toggle and a search over both levels.
- Ticking a specialty sends its id in `specialtyIds` and shows its
  subspecialties as included, without sending their ids. Ticking
  subspecialties alone sends `subspecialtyIds`.
- The send and preview contract is unchanged.
