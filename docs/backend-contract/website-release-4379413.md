# Website release `4379413` — deploy guide (2026-11-07)

Follows `d82d90a`, which is **on the server**. We checked before building
this: the live `en.json` already carries `settings.email_list_hint`, which is
the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**Deploy order: either way, backend first preferred.** This release adds the
**AI Suggestions** screen, built against the contract of 2026-11-07. Its
endpoints (`/admin/ai/suggestions*`) answered **404** on production when we
built this. Deployed before them, the new menu entry opens on *"Could not load
the questions"* with a Retry button, and nothing else is affected. The screen
starts working once the backend release with the two `ai_suggestions`
migrations is live.

---

## 1. The package

`hayai-web-4379413.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      4379413…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-4379413.tar.gz

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
cat /var/www/hayai-web/RELEASE                                       # 4379413…

curl -s $S/login | grep -o '<meta name="hayai-i18n-version" content="[^"]*">'
#   content="<16 hex characters>"   — if it says {{I18N_VERSION}}, stop and tell us

# this release's new strings must be in both dictionaries
curl -s "$S/assets/i18n/ar.json" | grep -c 'ai\.suggestions\.prompt_hint'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'ai\.suggestions\.prompt_hint'   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

**Click checks**, signed in as a super-admin, once the backend is live. These
questions are live app content, so look but do not save unless you mean it:

- **AI → AI Suggestions** opens on **Patient app** with 60 questions, and
  **Doctor app** shows 10. That is the 70 the migration copies in.
- The assistant filter lists the patient app's eight assistants. Nutrition
  reads *Patients & tourists*, and Medical Tourism and Report Explainer read
  *Tourists only*.
- Open any question. The form shows both titles, the slug and the hidden
  prompt with its `n / 2000` counter. Press **Back** without saving.

An admin without `ai.manage` sees the list with no Add, Delete, drag handles
or switches, and the form is read-only.

## 4. What changed since `d82d90a`

Two code commits, from the dashboard prompt and contract of 2026-11-07.

- `36f68cd`: the **AI Suggestions** screen at `/dashboard/ai/suggestions`,
  with a tab per app. Admins add, edit, switch off, delete and reorder the
  questions the AI assistant offers, each with a hidden prompt users never see.
  - The whole role is loaded with `per_page=all`, because reorder sends every
    id. Filters run on that list, and reordering is offered only with no
    filter on.
  - Drag and drop is native, as on the website blocks screen, with ↑↓ buttons
    for the keyboard. One reorder request runs at a time, and a failed one
    restores the last confirmed order.
  - The active switch saves at once and reverts on error. Edits send only the
    changed fields. Each 422 shows under its field.
  - The hidden prompt is never written to the browser console.
- `4379413`: the help line under the titles, from the updated contract. It
  says that users see the title, that an edit reaches them when the app
  reloads its assistants, and that a title must be unique within its
  assistant. The server enforces uniqueness, and its message shows under the
  field.

We tested the screen with a real admin sign-in on production and a local mock
of the suggestion endpoints, in English and Arabic. Nothing was written to
production.
