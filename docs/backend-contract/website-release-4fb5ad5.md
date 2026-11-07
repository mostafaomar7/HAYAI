# Website release `4fb5ad5` — deploy guide (2026-11-07)

Follows `4379413`, which is **on the server**: the live `/login` page loads
that release's bundle, `main-VQKUAJLW.js`.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Deploy order: either way.** This release adds the **AI Assistants** screen.
The on/off part uses `GET` and `PATCH /admin/ai/modules`, which already answer
on production for all 21 assistants. Adding **custom** assistants needs the
backend release that sends `is_custom` and accepts `POST` and `DELETE`, which
was not on production when we built this. Until then the list shows the 21
built-in assistants, each with its switch, and nothing else changes.

---

## 1. The package

`hayai-web-4fb5ad5.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      4fb5ad5…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-4fb5ad5.tar.gz

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

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200 (404 while the CMS home page is unpublished)
cat /var/www/hayai-web/RELEASE                                       # 4fb5ad5…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'ai\.assistants\.brief_hint'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'ai\.assistants\.brief_hint'   # 1
```

**Click checks**, signed in as a super-admin. **Every switch on this screen
reaches real users at once, so look, but do not switch anything unless you
mean it.**

- **AI → AI Assistants** opens on **Patient app** with 20 assistants and
  **Doctor app** with 1. The summary reads like *"20 assistants · 20 on"*.
- A row with suggestions shows its question count. Clicking it opens **AI
  Suggestions** filtered on that assistant.
- Click the doctor app's switch, read the confirmation, and press **Cancel**.
  The switch stays on.

Once the backend sends custom assistants, follow the backend prompt's own
checks: add *"Test Assistant"*, **keep it off**, add a question on AI
Suggestions, then delete it.

## 4. What changed since `4379413`

One code commit, `4fb5ad5`, from the dashboard prompt of 2026-11-07.

- **AI Assistants** at `/dashboard/ai/assistants`, with a tab per app.
  - Each assistant has its own switch. Turning one off is confirmed, and the
    doctor app's only assistant warns that doctors lose AI entirely. Turning
    one on is not confirmed. Either way the switch flips at once and reverts
    if the save fails. `enabled` goes as a JSON boolean.
  - Turning on a suggested assistant with no questions shows a warning.
  - The patient app's custom assistants can be added, edited and deleted:
    names, audience, banner lines and hidden instructions. A new one is
    created off, and the next step links to AI Suggestions filtered on it.
    Built-in assistants stay switch-only.
  - A banner warns when AI is off platform-wide in Settings.
  - The hidden instructions are never written to the browser console.
- **AI Suggestions** now accepts `?module=` in its URL, so both screens can
  open it on one assistant.

We tested the screen against the real production list, with every write
answered inside the browser, so no assistant was switched for users. The
custom-assistant flow was tested against a mock, in English and Arabic.

## 5. Not part of this release

The public site's pages return 404 because the CMS home page was unpublished
and five pages deleted from the dashboard on 2026-11-05. That is CMS content,
not this release, and redeploying does not change it.
