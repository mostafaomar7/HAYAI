# Website release `a1fb052` — deploy guide (2026-10-29)

Follows `d2b01c9`, which is **on the server**. We checked before building
this: the live `en.json` already carries `delete_has_orders`, which is the
string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`. Full
server setup, first time only:
[`website-golive-runbook-2026-10-04.md`](website-golive-runbook-2026-10-04.md).

**Deploy order: backend first.** This release is the dashboard half of the
devices brief of 2026-10-29
([`devices-internal-external-2026-10-29.md`](devices-internal-external-2026-10-29.md)).
Deployed before the backend, nothing breaks, but see section 5 for what
looks different until then.

---

## 1. The package

`hayai-web-a1fb052.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      a1fb052…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-a1fb052.tar.gz

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

A plain `restart` is enough. No `environment=` line changes, so no
`reread` or `update` is needed.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # a1fb052…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'gorders\.gallery_images'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'gorders\.gallery_images'   # 1

curl -sI $S/firebase-messaging-sw.js | grep -iE '^HTTP|cache-control'  # 200, no-cache
curl -s $S/login | grep -c 'name="hayai-firebase"'                     # 1
curl -s -o /dev/null -w '%{http_code}\n' $S/en/this-page-does-not-exist   # 404
for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin:

- **External devices → overview** has an **Add device** button.
- **Add device**, step 1 has a **More photos** field that takes several images.
- **A round's details** have two tabs, **Joined** and **Activity**. The
  **Pending** tab and the Approve and Reject buttons are gone. The members
  table has an **Order number** column.
- **The cost form** of a round has **Notes for users** and a separate
  **Shipping notes** field.
- **Internal devices → orders** no longer shows the All, External and Internal
  tabs.
- Nothing else changed. The rest of the dashboard is the regression check.

We ran this exact build against production before packaging it, read-only:
every screen above opened with no page errors and sent no writes.

## 4. What changed since `d2b01c9`

One code commit, `a1fb052`. The rest of the range is documents only.

- **Opening a round publishes the device.** Step 3 of the wizard sends
  `publish: true`, which the brief says puts the device in the app with its
  group open.
- **Cost notes reach members.** The "notes for users" field was sent as
  `notes`, which the backend does not read. It is now sent as
  `notes_for_users`, with a separate `ship_notes`.
- **Specifications carry their labels:** `label_en`, `label_ar`, `unit` and
  `sort_order`, from the category template.
- **Gallery photos** are sent as `images[]` when a device is created.
- **No join approval.** The Pending tab and the Approve and Reject actions
  are removed, because joining now counts at once. Removing a member stays.
- **Order number column** (`order_number`, such as `GO-10-27`).
- **Notifications** for `group_order.*` open `/dashboard/group-orders/{id}`.
- **Internal device orders** show internal orders only. The source tabs are
  gone, because the endpoint now returns internal orders only.

## 5. Until the backend change is live

- The **Order number** column shows `—`.
- Joining still waits for approval on the server, and the dashboard no longer
  shows that queue. Deploy the backend first to avoid that gap.
- Every live round has `joined: 0`, so the full flow has not been run once.
  After both deploys we need one test device with a group of 2 and two app
  users to walk it through: join, complete, cost, approve, hand-off.

## 6. Not part of this release

- The brief asks that the Internal add form require a company. **The
  dashboard has no Internal add form:** companies add their own devices from
  the partner app. If admins should add internal devices for a company, that
  is a new form and needs its fields from the backend.
