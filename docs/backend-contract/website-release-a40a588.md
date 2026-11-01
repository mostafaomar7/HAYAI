# Website release `a40a588` — deploy guide (2026-11-01)

Follows `b9921cb`, which is **on the server**. We checked before building
this: the live `en.json` already carries `guidelines.subspecialty_none`, which
is the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Deploy order: either way.** This is the dashboard half of the tourist plan
prompt of 2026-11-01. The backend half (the `tourist` plan type, the
"Tourist Plan" migration and `/admin/tourists/{id}/plan`) is not deployed yet.
Deployed before it, nothing breaks; section 5 says what looks empty until
then.

---

## 1. The package

`hayai-web-a40a588.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      a40a588…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-a40a588.tar.gz

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
cat /var/www/hayai-web/RELEASE                                       # a40a588…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'plans\.tourist_only_hint'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'plans\.tourist_only_hint'   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin:

- **Plans** has a **Tourist** tab next to **Patient**.
- **Plans → Patient → Edit modules** shows the line *"Changes here apply to
  patients only. Tourists have their own plan."*
- **Tourists** has a **Plan** column, and each row's menu has **Change
  plan**.

After the backend deploy, also:

- **Plans → Tourist** lists **"Tourist Plan"** with the **Default** badge.
  Its module editor says *"Changes here apply to tourists only."*
- **Tourists:** every row reads **Default plan**, except the QA tourist on
  "QA Patient Plan (internal)", which shows that name and offers **Reset to
  default**.

## 4. What changed since `b9921cb`

One code commit, `a40a588`.

- `tourist` is a plan type. The Plans screen has a Tourist tab. **Make
  default** works for tourist plans, with its own confirmation saying that
  patients are not affected.
- The module editor, in the list and on the plan page, says which audience a
  change reaches. The confirmation on save counts tourists for a tourist plan.
- The tourists list gains the patients' plan column, **Change plan**
  (`PATCH /admin/tourists/{id}/plan`) and **Reset to default**
  (`DELETE /admin/tourists/{id}/plan`). The server's `has_plan_exception`
  decides the badge and when Reset shows. A 422 shows the server's message.
- The plan picker, for patients and tourists alike, marks inactive plans
  "(internal)".

We checked this build against production with the tourist plan data mocked,
because the backend is not live. Writes were intercepted in the browser, so
nothing was written.

## 5. Until the backend change is live

- **Plans → Tourist** is empty.
- Every tourist reads **Default plan**, and **Change plan** says there are no
  plans to choose.

All of it fills in by itself after the backend deploy. No second web deploy
is needed.
