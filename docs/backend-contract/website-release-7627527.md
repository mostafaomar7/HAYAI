# Website release `7627527` — deploy guide (2026-10-22)

Follows `4121bd1`, which is **on the server** — we checked before building
this: the deployed bundle is `main-HP5Z63A7.js` and it carries the senior-care
and permission-area work from that release.

Same package shape, **no environment change, nothing to repeat from last
time**: replace the two folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

**This release needs no backend change and no deploy order.** Every endpoint it
calls already answers on production; we measured each one today. See section 5.

---

## 1. The package

`hayai-web-7627527.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      7627527…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-7627527.tar.gz

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
cat /var/www/hayai-web/RELEASE                                       # 7627527…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

V=$(curl -s $S/login | grep -o 'content="[0-9a-f]*"' | head -1 | cut -d'"' -f2)
curl -sI "$S/assets/i18n/en.json?v=$V"    | grep -i cache-control   # max-age=31536000, immutable
curl -sI "$S/assets/i18n/en.json?v=wrong" | grep -i cache-control   # no-cache

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'ai\.requests\.approve'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'ai\.requests\.approve'   # 1

curl -sI $S/firebase-messaging-sw.js | grep -iE '^HTTP|cache-control'  # 200, no-cache
curl -s $S/login | grep -c 'name="hayai-firebase"'                     # 1
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l       # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l    # 0
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist   # 404

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0

# the public pages must not change in this release — the Windows CTA was
# already live before it, and the marketing page is still parked
curl -s $S/ar/عن-حياة | grep -c HayaiPartnerSetup       # 1, same as before the deploy
curl -s $S/ar | grep -c badge-win                        # 0 — the parked page must stay parked
```

**Click checks**, signed in as a super-admin:

- **AI → Token requests** is a new sidebar entry. It opens, and today it
  shows the empty state — **"no requests"**, not an error and not a blank
  table. The queue really is empty (`total: 0`); if it reads as a failure
  instead, tell us, because those are different screens. We already ran
  **this exact build** against the live endpoint in both languages before
  packaging it, so this check is a confirmation, not a first look.
- The queue should look like the rest of the dashboard: a white card, a tab
  group top-right, a grey note bar above the table. If it reads as plain
  unstyled text, the deploy did not take — that is what `7627527` fixed.
- Open `/dashboard/ai/token-requests/1` by hand. With nothing in the queue it
  must say **"No request with that number."**
- **Settings → App versions** now names the eight Windows partner rows. The
  two rows that both read *"latest build"* before are now distinguishable:
  one says the Partner Windows app, the other the store build.
- Nothing else moved. The rest of the dashboard is the regression check.

Nothing in this release sends anything, and the AI screens can only write when
somebody presses Approve on a row — of which there are none.

## 4. What changed since `4121bd1`

Five code commits.

**The AI token-request queue** (`5e52ab9`) — built from the backend brief of
2026-10-22.

- `/dashboard/ai/token-requests`, with Pending / Approved / Rejected tabs and
  the `meta.pending_count` badge beside the page total. They are different
  numbers once a filter is on, so both are shown.
- `/dashboard/ai/token-requests/{id}` is a page of its own rather than a row
  that expands, because the backend's bell alert links straight to it and has
  to land somewhere that works with no list behind it.
- Approve is behind `ai.manage`; the screens behind `ai.view`.
- **A permission hole closed in the same commit.** `ai` had been in our area
  list since the access release with **no path mapped to it**, and our guard
  reads an unmapped dashboard path as "no area" — open to every admin,
  including the write buttons. This screen is the first URL under
  `/dashboard/ai/`, so it is what would have opened it. Measured after the
  fix: `ai.manage` → Approve enabled, `ai.view` → Approve absent, no `ai` →
  `/dashboard/no-access`.

**The eight Windows partner-app settings rows** (`1accfe1`) — named, after
finding two rows that both read "latest build" with nothing saying which app.

**The Windows Partner download on the marketing page** (`026bc6a`, `ed6e36a`)
— **no visible effect in this release.** That component is parked (no route
points at it), so the chunk is not even built; `grep -c badge-win` on `/ar`
returns 0 both before and after. It is in the diff so the diff is accounted
for. The button people can actually see is the CMS CTA
`get-app-partners-windows`, which was already live on three published pages in
both languages before this release.

**The AI screens had almost no styling** (`7627527`) — found by looking at
them, after everything above had been measured.

Dashboard styles are component-scoped: every screen carries its own copy of
the table-card look, and these two were written against `styles.css` as if it
were shared. The queue rendered as unstyled text — no card, no table padding,
the tabs as three bare words. It behaved correctly the whole time, which is
exactly why no measurement caught it. Both stylesheets now carry the house
copy.

The screenshots then showed three more: the account type printed raw (a
literal `patient` in an Arabic table), a grant read `50000` rather than
`50,000`, and the Arabic badge read `3 طلب` — Arabic agrees the noun with the
number at zero, one, two and again past ten, so it now says `3 طلبات`, and an
empty queue says `لا توجد طلبات` instead of `0 طلب`.

The four other commits in the range are documents only.

## 5. Nothing is needed from you, and here is the measurement

Every endpoint this release calls answers on production today:

```
GET /admin/ai/token-requests                  200   (total 0, pending_count 0)
GET /admin/ai/token-requests?status=pending   200
GET /admin/access/me                          200   areas.ai = {view:true, manage:true}
GET /app/version-gate  (windows, partner)     200   download_url → …1.0.1.12.exe
```

`areas.ai` matters: our guard needs the server to publish the area, and it
does. Had it been missing, the new sidebar entry would have been hidden from
everyone rather than wrongly shown to anyone — the same conservative rule as
`4121bd1` section 5.

**One thing to know about who can use this screen.** Of the thirteen roles,
exactly one carries `ai.manage` — `super-admin`, held by one admin.
`read-only` carries `ai.view` and has no admins at all. So after this deploy
**the super-admin is the only person who can approve an AI token request.** If
somebody else is meant to work that queue, a role needs `ai.manage` added;
that is a decision, not a bug, so we have not touched it.

## 6. Still open, and not part of this release

- The AI brief's two shape questions (`reviewed_by`, `period`) and whether
  `ai.tourist_monthly_tokens` is meant to stay unset:
  [`api-reply-ai-token-requests-live-2026-10-22.md`](api-reply-ai-token-requests-live-2026-10-22.md).
- `/admin/ai/allocations`, `/admin/ai/usage` and `/admin/ai/overview` answer
  and nothing in the dashboard calls them. An admin who approves a grant has
  nowhere to see the allocation it created. That is its own piece of work and
  we would rather be asked for it than guess at it.
