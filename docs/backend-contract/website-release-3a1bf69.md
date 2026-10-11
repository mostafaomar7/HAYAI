# Website release `3a1bf69` — deploy guide (2026-10-11)

Same shape as release `c979a35`, and **nothing in the environment changes**:
no new variables, no API change needed to deploy. Replace the two folders and
restart — section 2 is the whole job.

The site is **server-side rendered**: a Node process under Supervisor with
nginx in front, not a folder of static files. Uploading this to Hostinger
`public_html` serves a blank shell to crawlers and breaks every page the SEO
and measurement specs rely on. Full server setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-3a1bf69.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files (JS, CSS, fonts, images) — 5.1 MB
  server/      server.mjs and its chunks — 4.9 MB
  DEPLOY.md    this file
```

- **Self-contained.** No `npm install`, no `node_modules`. Verified by running
  `node server/server.mjs` from a folder holding nothing but these two
  directories: `/ar` → 200, `/login` → 200, `/en/no-such-page` → 404.
- **Node 20 or newer** (built and tested on 22).
- `browser/` and `server/` **must stay side by side** — `server.mjs` resolves
  the static files at `../browser`.

## 2. Deploy

```bash
# 1. Upload hayai-web-3a1bf69.tar.gz to the server (scp / sftp), then:
cd /tmp && tar -xzf hayai-web-3a1bf69.tar.gz          # → /tmp/hayai-web/

# 2. Keep the running build as a rollback copy.
sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

# 3. Replace it. Remove the old folders first: file names are hashed per
#    build, so extracting on top leaves the previous release's files behind
#    forever.
sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo chown -R www-data:www-data /var/www/hayai-web

# 4. Restart. No `reread`/`update` this time — the variables did not change.
sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web                    # RUNNING
```

About two seconds of downtime during the restart.

**Rollback:**

```bash
sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /var/www/hayai-web.prev/browser /var/www/hayai-web.prev/server /var/www/hayai-web/
sudo chown -R www-data:www-data /var/www/hayai-web
sudo supervisorctl restart hayai-web
```

### If the variables were never set

Only relevant if this is the first deploy on a fresh server, or if the GTM
container stopped printing. The complete list and the Supervisor block are in
section 2 of
[`website-release-c979a35.md`](website-release-c979a35.md) — unchanged. After
editing the Supervisor file, a plain `restart` keeps the old values:

```bash
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl restart hayai-web
```

## 3. Check — paste the output back to us

```bash
S=https://hayaihealthcare.com

# Running, and serving
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en      # 200
tail -n 20 /var/log/hayai-web.log                                       # no errors, no "[seo] WARNING"

# Public pages still measured: the container prints exactly twice
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l                          # 2

# The dashboard is deliberately NOT measured: zero, both lines
curl -s $S/login     | grep -o 'GTM-5VKC5CMT' | wc -l                   # 0
curl -s $S/dashboard | grep -o 'GTM-5VKC5CMT' | wc -l                   # 0

# Real status codes
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist # 404

# Dashboard served, and the new screen reachable
curl -s -o /dev/null -w '%{http_code}\n' $S/login                                      # 200
curl -s -o /dev/null -w '%{http_code}\n' $S/dashboard/account-deletion-requests        # 200
```

If the `GTM-5VKC5CMT` count on `/ar` is `0`, the variables were lost: run
`reread && update`, then `restart`.

---

## 4. What changed in this release

Dashboard only. No public page, no rendering, no tracking code was touched —
the whole diff since `c979a35` is 33 files under `src/app/features/dashboard`,
`src/app/core/services` and `src/styles.css`.

- **Delete an account, not only block it.** A `Delete account` item on all 12
  user lists, behind a typed `DELETE` confirmation, reporting back whether the
  account was removed outright or closed and wiped.
- **Account deletion requests inbox** — a new screen at
  `/dashboard/account-deletion-requests`, with pending / completed / rejected
  tabs. Completing one always asks which matched account, then the typed word;
  the button is disabled when nothing matched the email or phone.
- **Doctor credentials verification** — a card on the doctor's page, with the
  bilingual note.
- **Open-ended subscription plans** — the bug where a plan with no end date
  could not be saved.
- **External device orders** — the internal / external source filter, the
  group-purchase round on the order, the pending-price flag, and the bell
  notification now opening the order itself instead of the list.

### The endpoints these screens call

Nothing here is new work for you — they are the ones from the QA round. Listed
so that a `404` or a `405` after this deploy is read on the right side:

| Method | Path |
|---|---|
| `DELETE` | `/admin/{resource}/{id}` — body `{"confirm":"DELETE"}`, returns `{user_id, mode}` where `mode` is `deleted` or `erased` |
| `GET` | `/admin/account-deletion-requests?status=&page=&per_page=` |
| `POST` | `/admin/account-deletion-requests/{id}/complete` — body `{"user_id":N,"handled_note":"…","confirm":"DELETE"}` |
| `PATCH` | `/admin/account-deletion-requests/{id}` — body `{"status":"rejected","handled_note":"…"}` |
| `PATCH` | `/admin/doctors/{id}/credentials-verification` — body `{"credentials_verified":bool,"credentials_verified_note_en":"…","credentials_verified_note_ar":"…"}` |
| `GET` | `/admin/external-device-orders?source=internal\|external` — rows carrying `device_source`, `price_pending`, `group_round` |

Two notes on the inbox, because they have not been exercised against real data:

- The list is **empty in production**, so the screen was built against the
  documented response shape only. The first real row is worth watching
  together.
- `matched_accounts` is what the screen offers the admin to choose from. If the
  API returns it as `null` or leaves it out, the row shows "no match" and
  **Complete stays disabled** — which is the safe failure, but it means a real
  request cannot be completed from here until the field arrives.

## 5. Still open on the client's side — not blockers for this deploy

- Both Play Store apps still return 404 (in review). No campaign should spend
  before they are live.
- Test leads are still in production data, `LD-261006-GWXSG9` among them. They
  should be deleted before launch so they do not land in reporting.
