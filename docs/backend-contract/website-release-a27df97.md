# Website release `a27df97` — deploy guide (2026-11-26)

Follows `62e97fa`. Same package shape, **no environment change**: replace the
two folders and restart. Section 2 is the whole job.

**If `62e97fa` or `a1d245f` is not deployed yet, deploy this one instead:** it
contains both, and their after-deploy steps still apply.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Website requests become HAYAI patients (Phase 1)** — the frontend of the
backend brief of 2026-11-26. The API side is already live on production.

---

## 1. The package

`hayai-web-a27df97.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      a27df97…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-a27df97.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree: delete the two folders first.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/ar     # 200
cat /var/www/hayai-web/RELEASE                                       # a27df97…
curl -s -o /dev/null -w '%{http_code}\n' "$S/ar/requests/LD-TEST?token=x"   # 200 (page says "link not valid")
curl -s -D - -o /dev/null "$S/ar/requests/LD-TEST?token=x" | grep -i cache-control   # no-store
curl -s "$S/assets/i18n/ar.json" | grep -c '"web.forms.account_mode"'      # 1
```

`/ar/requests/...` must reach the Node app like every other `/ar/...` path
(it does with the current nginx config; nothing to add).

## 4. After the deploy (the admin)

Already created on production, waiting for this deploy:

- **Form `care-request`** («اطلب رعاية»): three fields (need, area, mobile),
  patient account «التحقق قبل الإرسال».
- **Header button «اطلب رعاية»** (CTA `request-care-header`), **disabled**:
  the old site would open the form without the code step and the API would
  refuse the request. Once this release is live:
  Dashboard → الموقع الإلكتروني → أزرار الإجراءات (CTA) → «اطلب رعاية» → enable.

Then test once from a phone with a real number:

1. Click «اطلب رعاية» in the header, fill the three fields, «أرسل الرمز».
2. Enter the SMS code, accept the terms, «تحقّق وأرسل الطلب».
3. The confirmation shows the reference, «تابع طلبك» and the app prompt.
4. Dashboard → العملاء المحتملون: the request has «تم التحقق بالموبايل» and
   «حساب من الموقع». The overview shows the «مرضى من الموقع» card.
5. Open the form again: it says «المتابعة بالرقم …» instead of asking again.

The ICU bed request already ships as «التحقق بعد الإرسال»: the request goes at
once and the code is offered on the confirmation.

## 5. What changed since `62e97fa`

Two code commits, `ff1204b` and `a27df97`.

**Public site**
- Forms follow `account.mode` (none / before_submit / after_submit).
- Code step: masked number, change number, resend countdown, 4-digit
  one-time-code input (Arabic digits accepted), consent with the policy
  versions from `/about`, a message for every error code. If SMS codes are
  unavailable the request is sent as a plain lead: it is never lost.
- «المتابعة بالرقم … · ليس رقمك؟» for a verified visitor.
- `X-Website-Session` and `Idempotency-Key` on submissions: a retry after a
  lost connection reuses the same key and body, so no request is sent twice.
  The form draft survives a refresh and the code step.
- Confirmation with reference, tracking link (copy / share) and a soft app prompt.
- New page `/{locale}/requests/{reference}?token=` (noindex, never cached).
- Events `request_started`, `confirmation_viewed`, `app_handoff_clicked`.
- A header CTA is its own Navy button (also on phones); «حمّل التطبيق» stays
  a button, outlined.
- **Fix:** forms opened from a CTA (modal, or an inline form a CTA scrolled to)
  could not be clicked: a global CSS rule disabled the mouse inside anything
  marked as a CTA. Now limited to the button itself.
- **Fix:** an admin signed in to the dashboard no longer sends their admin
  token with the website's calls (it filed their test requests under the
  admin account).

**Dashboard**
- Form builder: «حساب المريض» (locked to «طلب فقط» for business forms); the
  forms list shows the mode.
- Leads: account badges in the list and detail (link to the account's
  activity), filters «ليه حساب» and «طريقة الربط».
- Overview: «مرضى من الموقع» card. Patients: «الموقع» badge and a sign-up
  source filter.

Tested in the browser in Arabic and English, desktop and phone widths, against
production reads. The code, verify and submit calls were mocked, so no SMS was
sent and no test request was created. Phase 2 and 3 (app handoff, deep links)
are not in this release.
