# Website release `4121bd1` — deploy guide (2026-10-19)

Follows `188ff32`, which we confirmed is **already on the server** before
building this (`/firebase-messaging-sw.js` answers 200, `connect-src` carries
the FCM hosts, and `hayai-firebase` is in the page — so your
`FIREBASE_WEB_CONFIG` is in place too).

Same package shape, **no environment change, nothing to repeat from last
time**: replace the two folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

**Deploy order against your own next release: it does not matter.** See
section 5.

---

## 1. The package

`hayai-web-4121bd1.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      4121bd1…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-4121bd1.tar.gz

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

A plain `restart` is enough here: no `environment=` line changes, so no
`reread`/`update`.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
`chown`, restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # 4121bd1…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

V=$(curl -s $S/login | grep -o 'content="[0-9a-f]*"' | head -1 | cut -d'"' -f2)
curl -sI "$S/assets/i18n/en.json?v=$V"    | grep -i cache-control   # max-age=31536000, immutable
curl -sI "$S/assets/i18n/en.json?v=wrong" | grep -i cache-control   # no-cache

curl -sI $S/firebase-messaging-sw.js | grep -iE '^HTTP|cache-control'  # 200, no-cache
curl -s $S/login | grep -c 'name="hayai-firebase"'                     # 1
curl -sI $S/ar | grep -o "style-src[^;]*"            # has 'unsafe-inline', no nonce
curl -sI $S/login | grep -o "script-src [^;]*"       # has 'nonce-…'
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l       # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l    # 0
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist   # 404

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin:

- **Users → Senior Care** is a new sidebar entry. It lists the one real home.
  Open it: the detail page loads, and **Change plan** offers exactly the three
  senior-care plans and no hospital plan.
- **Hospital verifications** now has a second tab row — All / Hospitals /
  Senior care. "pending + senior care" is empty, "verified + senior care" is
  the one home. The wording on that screen says *facility*, not *hospital*.
- **Lists → Clinical guidelines** still opens, and so does **External Medical
  Devices**. Nothing changed for a super-admin; this is the regression check
  for section 5.

Nothing in this release sends anything, so no check here can set something off.

## 4. What changed since `188ff32`

Two code commits, and one that only corrects comments.

**Senior Care as its own account type** (`6cf98b5`) — built from your prompt of
2026-10-15, after confirming every endpoint in it answers on production.

- Its own sidebar entry, its own route `/dashboard/senior-care`, its own
  section — never folded into Hospitals.
- Twelve places needed the type named by hand; three of them were lists that
  would otherwise have silently offered the wrong thing: an advert's owner
  types (your API checks `provider_type` against the owner's account, so a
  senior-care owner could not have been chosen at all), the broadcast
  picker's fallback list, and the renewals filter's fallback list.
- The verification queue is shared, so it gained the tab row above rather than
  a filter, and its copy stopped calling every row a hospital.
- Change plan is scoped to senior-care plans. Worth knowing: the **server
  accepts a hospital plan on a senior-care account** — it does the same for
  hospitals and clinics today — so that dropdown is the only thing keeping
  them apart.

**Clinical guidelines and External devices as their own permission areas**
(`6968f35`) — your prompt of 2026-10-19. Section 5.

**Comment corrections** (`488ba3a`) — two comments in our source claimed the
API accepted an unknown broadcast user type and did not validate `link`. Your
`5d94459` made both false, so they were rewritten. No behaviour change; it is
in this list only so the diff is accounted for.

## 5. The permission areas, and why deploy order does not matter

`clinical_guidelines` and `external_devices` are in our route map as of
`6968f35`, and as of today `/admin/access/me` does not return them yet.

An area the server has not shipped is **absent** from `areas`, not present and
false, and a missing key would otherwise read as denied — which would have
taken Clinical guidelines and Group orders away from every non-super-admin
between our release and yours, invisibly to a super-admin. So an unknown new
key falls back to the area it was split from (`clinical_guidelines` →
`doctors`, `external_devices` → `medical_devices`), which is the same grant
you copy over in your deploy.

Therefore:

- **This release before yours:** limited admins keep both sections through the
  fallback.
- **Yours before this release:** your keys arrive and are simply not read yet;
  the old areas still gate those screens here.
- **Either way, once both are out** the fallback is unreachable and nothing has
  to be undone.

Detail and the four cases we tested:
[`api-reply-two-areas-2026-10-19.md`](api-reply-two-areas-2026-10-19.md) and
[`api-reply-two-areas-closed-2026-10-19.md`](api-reply-two-areas-closed-2026-10-19.md).

## 6. Still open on the API — unchanged by this deploy

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated; the hash for the
  public-picker fix; and plan 74. **Approving a new senior-care home is still
  better held until the public picker is fixed** — this release does not change
  that.
- [`api-items-round4-2026-10-14.md`](api-items-round4-2026-10-14.md) —
  `months: 0`, and plan 52's intended discount (stored `0.50`; if it means 50%
  rather than 0.5% the difference is 24,750 EGP per clinic, so we will not
  guess), plus the plan 64 and 43 descriptions.
- [`api-items-round3-2026-10-14.md`](api-items-round3-2026-10-14.md) — the QA
  leftovers, now nine: device categories 6 and 7, shipping companies 3 and 4,
  redirects 1 and 2, plans 67 and 74, and the menu `qa-test-mm`. Also the role
  `qa-test-mm-role` from the last release.
