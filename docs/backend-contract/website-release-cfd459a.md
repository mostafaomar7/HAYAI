# Website release `cfd459a` — deploy guide (2026-11-22)

Follows `29bfa2d`. Same package shape, **no environment change**: replace the
two folders and restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**One dashboard change:** the advert form. Nothing on the public site changes.

- **Audience** ("who can see this ad"): the API has accepted it since
  2026-10-18, so it works as soon as this is deployed.
- **"Hayai" as the advertiser:** the API side is **not deployed yet**. Until it
  is, saving an advert with owner type "Hayai" answers 422 and the form shows
  the message. Nothing else is affected, and no deploy order is required.

---

## 1. The package

`hayai-web-cfd459a.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      cfd459a…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-cfd459a.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree: file names are hashed per build, so
the `rm -rf` of the two folders first is not optional.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/ar     # 200
cat /var/www/hayai-web/RELEASE                                       # cfd459a…

curl -s "$S/assets/i18n/ar.json" | grep -c '"ads.audience"'      # 1
curl -s "$S/assets/i18n/ar.json" | grep -c '"ads.owner_hayai"'   # 1
for u in / /ar /login /dashboard; do curl -sL "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks (Dashboard → Advertisements):**

- Open any advert: the form has **«من يمكنه رؤية الإعلان»** with three
  choices, preset to the advert's own value.
- **Add advertisement**: the owner type list starts with **«حياي»**. Choosing
  it replaces the account picker with **«اسم المعلن»**.
- Please do not create test adverts on production; if one is needed, delete it
  afterwards.

## 4. What changed since `29bfa2d`

One code commit, `cfd459a`, from the backend reply of 2026-11-22.

- **Audience:** `audience=all|patient|tourist` on create and edit. New adverts
  start on `all`. An edit starts on the stored value and sends what the
  control shows, so saving another change never widens a provider's
  tourists-only advert. The list shows a badge on patients-only and
  tourists-only adverts.
- **Hayai as the advertiser:** "Hayai" heads the owner-type list (it is not an
  account type, so it is not in `/lookups/user-types`). It sends
  `provider_type=hayai` + `owner_name` (required, up to 255, not blank) and no
  `owner_id`. Editing a Hayai advert prefills the text. Switching a Hayai
  advert to an account type requires picking the account.

Tested in the browser against production reads, with every save intercepted:
each case above sent exactly those fields, and blank text or a missing
account was refused before sending.
