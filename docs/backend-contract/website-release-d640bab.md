# Website release `d640bab` — deploy guide (2026-10-15)

Follows `9b12a32`. **Nothing urgent in this one** — if `9b12a32` is already on
the server, this can go whenever suits you. If it is not, deploy this instead:
it contains everything that one did, including the advertisement `status` trap.

Same package shape as before, **no environment changes**: replace the two
folders and restart. Section 2 is the whole job.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-d640bab.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      d640bab…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-d640bab.tar.gz

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

The server process is unchanged from `9b12a32`, so these are the same checks:

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # d640bab…

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

**The one thing to click.** Open **Send notification** signed in. It should show
account-type checkboxes rather than a single dropdown, and a green bar reading
"Will reach 91 accounts" before anything is typed. Tick **Pharmacies** on its
own: the bar must read **7**, not 0. That number is the whole point of this
release — see section 4.

Do not press Send unless you actually want a broadcast to go out.

## 4. What changed since `9b12a32`

Three commits, all on the notifications screens. No change to the server
process, no environment change, nothing on any other screen.

**The reason this release exists.** The Send-notification screen's audience
list was written from this dashboard's own names rather than the API's, so
three of its thirteen options sent a user type the API does not have:

```
pharmacy          reached 0        pharmacies         7
lab               reached 0        labs_radiology     5
medical_issuance  reached 0        medical_insurance  4
```

The API accepts an unknown type without complaint and matches nobody, so the
screen reported a successful send every time. `GET /broadcast/history` shows
four broadcasts that already went out this way — ids 2, 10 and 11 to
`pharmacy`, id 15 to `lab`, all four with `queued_recipients: 0`, while every
correctly-spelled broadcast delivered. The list now comes from
`/lookups/user-types`.

**The new targeting**, built from the API prompt of 2026-10-15 and verified
against production before building:

- Account types as checkboxes, so one broadcast can reach several at once.
- A gender filter under patients and tourists. It narrows only those two —
  every other selected type is left whole.
- A specialty and subspecialty picker under doctors, from `/doctor/specialties`.
- The number of accounts a selection reaches, shown live before sending and
  taken from the API's own counting endpoint, so it is the number that will
  actually be delivered. Reaching nobody is styled as a warning, not a success.
- An optional **Link** field: recipients get an "Open link" button for it.
  The API has no validation rule for this field yet, so the form checks it —
  `http`/`https` only, 255 characters.
- Title and body limits enforced before sending, with live counters, and a 422
  that names the field instead of only saying "Validation failed".

**The history screen** now names the audience in the admin's own language and
says when a broadcast was narrowed by gender or specialty. Before, a broadcast
to female patients and one to all patients rendered identically. Rows that
targeted `pharmacy` or `lab` still print those raw values deliberately: that
broadcast did not reach pharmacies, and labelling it "Pharmacies" would say it
did.

**Still open on the API**, unchanged by this deploy:

- [`api-reply-broadcast-2026-10-15.md`](api-reply-broadcast-2026-10-15.md) —
  the four things we need, the first being a 422 on an unknown `userTypes[]`
  value so this class of silent non-delivery cannot recur.
- [`api-items-round5-2026-10-14.md`](api-items-round5-2026-10-14.md) — item 18,
  a navigation menu cannot be deleted.
- [`api-items-round4-2026-10-14.md`](api-items-round4-2026-10-14.md) — `months: 0`,
  and two plan descriptions.
- [`api-items-round3-2026-10-14.md`](api-items-round3-2026-10-14.md) — item 15
  and the QA leftover list.
