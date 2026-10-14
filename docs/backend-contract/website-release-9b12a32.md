# Website release `9b12a32` — deploy guide (2026-10-14)

**Deploy this one.** The version on production pins an advertisement to
`expired` whenever anyone edits it — including adverts whose end date is months
away. Details in section 4. Everything else here is a QA round's worth of
dashboard fixes.

Same package shape as before, **no environment changes**: replace the two
folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-9b12a32.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      9b12a32cb8a1a96d4dd52990f6a47327557b7df6
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-9b12a32.tar.gz

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

Nothing in the server process changed in this release, so these are the same
checks as last time and should all still pass:

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # 9b12a32…

# the page carries a real dictionary hash, not the literal placeholder
curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

V=$(curl -s $S/login | grep -o 'content="[0-9a-f]*"' | head -1 | cut -d'"' -f2)
curl -sI "$S/assets/i18n/en.json?v=$V"    | grep -i cache-control   # max-age=31536000, immutable
curl -sI "$S/assets/i18n/en.json?v=wrong" | grep -i cache-control   # no-cache

curl -sI $S/ar | grep -o "style-src[^;]*"            # has 'unsafe-inline', no nonce
curl -sI $S/login | grep -o "script-src [^;]*"       # has 'nonce-…'
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l       # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l    # 0
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist   # 404

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**One new thing worth a click.** Several dashboard routes changed spelling (see
section 4). The old spellings redirect, so this should hold:

```bash
# all four land on the lower-case path, and none of them 404
for u in /dashboard/Advertisements /dashboard/Oncology /dashboard/HyperbaricOxygen-add; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "$S$u"   # 200, the SPA shell
done
```

The redirect itself happens in the browser, not on the server, so the real
check is to open `https://hayaihealthcare.com/dashboard/Oncology/edit/1` while
signed in and confirm the address bar ends `/dashboard/oncology/edit/1` — with
the **1 still on it**.

## 4. What changed since `a399243`

13 commits, all in the dashboard. Nothing in the server process, nothing in the
environment.

**The one that matters.** Editing an advertisement sent `status` back exactly
as the API had returned it. The API returns `expired` for an advert whose end
date has passed — a derived state, not a stored one — so saving any edit wrote
`expired` into the record permanently, even after the end date was pushed into
the future. The dashboard now sends `status` only when the admin actually
changed it, and never sends a derived `expired`. **This is live on production
today**, which is the reason to deploy.

**Counts and dates:**

- A count and its noun now agree, in both languages: "1 user" not "1 users",
  "1 month" not "1 months", and the Arabic dual and plural forms besides. This
  was on 18 screens, not the one QA filed.
- The renewals list says out loud that it shows subscriptions about to lapse,
  so the future dates in it stop reading as a bug. A term that ends on the day
  it starts is flagged as a broken record rather than a lapsed one.
- Prices on the renewals list come from the API's own `final_price` and
  `discount_percent` rather than being recomputed here, so a later change to a
  plan does not rewrite what a subscriber paid.

**Dialogs and defaults:**

- A delete dialog names the record it is about to delete — nine places that
  said only "Delete plan?" or "Delete center?".
- "Cancel Round" no longer sits next to a button labelled "Cancel". The
  dismiss button says what it keeps, the destructive one is red, and a cancel
  with no reason typed keeps the dialog open instead of closing silently.
- New records — authors, CTAs, redirects, categories, clinical guidelines —
  start switched off rather than live.
- The add-device wizard's last step says that it opens a round users can join
  immediately, and a device can now be saved without opening one.

**Routes.** `Advertisements`, `Oncology` and `HyperbaricOxygen` were
capitalised while the rest of the dashboard is kebab-case. They are lower-case
now and the old spellings redirect. Writing those redirects turned up a second
defect, fixed in the same commit: an absolute `redirectTo` string does not
substitute `:id`, so `external/orders/:id` had been dropping the id since it
was added.

**Validation messages.** A 422 from the API carries the field and the reason;
the dashboard was showing only the heading, "Validation failed". It now shows
what actually failed, with the request's own field path taken out of the
sentence. A focal point outside 0–100 is refused in the form rather than
silently clamped.

**Still open on the API**, unchanged by this deploy:

- [`api-open-items-2026-10-13.md`](api-open-items-2026-10-13.md) — the
  original eight, all answered.
- [`api-items-round3-2026-10-14.md`](api-items-round3-2026-10-14.md) — item 15
  and the QA leftover list.
- [`api-items-round4-2026-10-14.md`](api-items-round4-2026-10-14.md) — items 16
  and 17: `months: 0`, and two plan descriptions.
- [`api-items-round5-2026-10-14.md`](api-items-round5-2026-10-14.md) — item 18:
  a navigation menu cannot be deleted, and `qa-test-mm` is stuck on production
  because of it.
