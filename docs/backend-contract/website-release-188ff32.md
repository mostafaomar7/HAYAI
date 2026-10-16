# Website release `188ff32` — deploy guide (2026-10-16)

Follows `d640bab`. Same package shape as before: replace the two folders and
restart. **No environment change is required.** One new variable is
optional (section 3) and only switches on browser notifications for admins.

The site is server-side rendered — a Node process under Supervisor with nginx
in front, not a folder of static files. Never into `public_html`. Full server
setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

---

## 1. The package

`hayai-web-188ff32.tar.gz` (also as `.zip`, identical content):

```
hayai-web/
  browser/     static files (now including firebase-messaging-sw.js)
  server/      server.mjs and its chunks
  RELEASE      188ff32…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-188ff32.tar.gz

sudo rm -rf /var/www/hayai-web.prev
sudo cp -r /var/www/hayai-web /var/www/hayai-web.prev

sudo rm -rf /var/www/hayai-web/browser /var/www/hayai-web/server
sudo cp -r /tmp/hayai-web/browser /tmp/hayai-web/server /var/www/hayai-web/
sudo cp /tmp/hayai-web/RELEASE /var/www/hayai-web/RELEASE
sudo chown -R www-data:www-data /var/www/hayai-web

sudo supervisorctl restart hayai-web
sudo supervisorctl status hayai-web          # RUNNING
```

Do **not** extract over the running tree — file names are hashed per build.
`rm -rf` on the two folders first is not optional.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
`chown`, restart.

## 3. Optional: browser notifications for admins

The dashboard can now register the browser for the admin alerts you already
push over FCM (your contract of 2026-10-16, §9). It stays off — no button is
shown — until the server has the Firebase web config.

1. Firebase console, **the same project the mobile apps use**:
   - Project settings → Your apps → **Web app** (create one if missing) →
     copy the config object.
   - Project settings → Cloud Messaging → **Web Push certificates** →
     Generate key pair → copy the key.
2. Put both into one line of JSON, the key as `vapidKey`:

   ```json
   {"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…","vapidKey":"…"}
   ```

3. Add it to the Supervisor program's `environment=` line, **in single
   quotes** (the JSON has commas and double quotes), alongside the existing
   variables:

   ```ini
   environment=NODE_ENV="production",PORT="4000",…,FIREBASE_WEB_CONFIG='{"apiKey":"…","projectId":"…","messagingSenderId":"…","appId":"…","vapidKey":"…"}'
   ```

4. `sudo supervisorctl reread && sudo supervisorctl update hayai-web`
   (a plain `restart` does not pick up a changed `environment=`).

Nothing in it is secret — Firebase web config is public by design — but it
still belongs in Supervisor, not in the repo. If the JSON is malformed the
server logs `FIREBASE_WEB_CONFIG is set but is not JSON …` and keeps
notifications off; the site is unaffected either way.

Can be done now or later; it needs no rebuild.

## 4. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # 188ff32…

curl -sI $S/firebase-messaging-sw.js | grep -iE '^HTTP|cache-control|content-type'
#   200, Cache-Control: no-cache, text/javascript

curl -sI $S/login | grep -o "connect-src [^;]*"
#   … https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com

curl -s $S/login | grep -c 'name="hayai-firebase"'
#   0 without FIREBASE_WEB_CONFIG, 1 with it

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'   # 16 hex chars
curl -s $S/ar | grep -o 'GTM-5VKC5CMT' | wc -l       # 2
curl -s $S/login | grep -o 'GTM-5VKC5CMT' | wc -l    # 0
for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin:

- Signing in lands on the dashboard as before.
- The sidebar has a new section **Admins & roles** → **Admins** lists the
  accounts, **Roles & permissions** shows the View/Manage matrix. Open a role
  and close it — no need to save.
- **Settings** shows a new group **Admin alerts** with 16 switches.
- With section 3 done: the user menu (top right) has **Turn on
  notifications**.

## 5. What changed since `d640bab`

**Admin roles & permissions** (`188ff32`) — built on your contract of
2026-10-16 and checked against production, where it is already live:

- Sidebar, routes and write buttons follow `admin_access`. A section the
  admin cannot view is hidden, opening its URL lands on a "No access" page,
  and on a view-only section the add/edit/delete/approve/block buttons are
  hidden (48 screens).
- 403 `ADMIN_PERMISSION_DENIED` shows one "You don't have access" toast and
  re-reads `/admin/access/me`. It never signs anyone out; 401 still does.
- New super-admin screens: **Admins** (create with the one-time temporary
  password, edit, roles, deactivate/reactivate, reset password, resend
  invitation) and **Roles & permissions** (the matrix plus the website
  permissions). The old Website → Roles page is retired and redirects there.
- `must_change_password`: the admin is held on Change password until done.
- Home shows no charts without `statistics.view`.
- The bell opens `data.dashboard_path`, so reports, tickets, deletion
  requests, leads and purchases are now clickable.
- Browser notifications (section 3), token removed on logout.
- Login now keeps the account from the login response (it read `res.user`,
  which the API does not send), so `admin_access` and
  `must_change_password` apply from the first screen.

**Menus** (`78d5276`): a menu other than `header`/`footer` can be deleted
(`DELETE /admin/website/menus/{key}`, your `5d94459`).

**Plans** (`d21b8cb`): live before/after price while typing a discount; the
details page shows `final_price`; an emptied price is refused instead of
being saved as 0 (the cause of plans 17, 20, 36, 52–60 going to 0).

**One leftover on production:** the role `qa-test-mm-role` (0 admins) from
QA. Delete it from Roles & permissions, or via the API, when convenient.
