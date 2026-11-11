# Website release `09291e6` — deploy guide (2026-11-11)

Follows `4fb5ad5`, which is **on the server**. We checked before building
this: the live `en.json` already carries `ai.assistants.brief_hint`, which is
the string that release added.

Same package shape, **no environment change**: replace the two folders and
restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**This release needs no backend change.** The block catalogue already sends
`accept` on media fields, and the media library already takes videos. Both
were measured on production before packaging.

**Why it matters now:** a video section is already published on the test page
`/ar/صفحه-تجريبيه`, and it does not play. The video file answers fine
(`200`, `video/mp4`, ranges supported). The live site's Content-Security-Policy
has no `media-src`, so it falls back to `default-src 'self'` and the browser
refuses a file from `api.hayaihealthcare.com`. This release fixes that in
`server.ts`. Nothing on the page needs to change.

---

## 1. The package

`hayai-web-09291e6.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files
  server/      server.mjs and its chunks
  RELEASE      09291e6…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-09291e6.tar.gz

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

The restart is required, not just the copy: the CSP is set by `server.mjs`, so
the old process keeps sending the old header until it is restarted.

**Rollback:** copy `browser/` and `server/` back from `/var/www/hayai-web.prev`,
run `chown`, and restart.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/en    # 200
cat /var/www/hayai-web/RELEASE                                       # 09291e6…

# the fix: the CSP must now allow the API origin for media, and the two players
curl -sI $S/en | grep -i content-security | tr ';' '\n' | grep -E 'media-src|frame-src'
#   media-src 'self' https://api.hayaihealthcare.com
#   frame-src … https://www.youtube-nocookie.com https://player.vimeo.com

curl -s "$S/assets/i18n/ar.json" | grep -c 'web\.blocks\.field\.video_file'   # 1
curl -s "$S/assets/i18n/en.json" | grep -c 'web\.blocks\.field\.video_file'   # 1

for u in / /ar /login /dashboard; do curl -s "$S$u" | grep -c '{{' || true; done   # 0 0 0 0
```

If the first `grep` still shows no `media-src`, nginx may be adding its own
`Content-Security-Policy` header. Check with `curl -sI http://127.0.0.1:4000/en`
on the server: if the header there has `media-src` and the public one does not,
the nginx config is overriding it.

**Click checks:**

- Open `https://hayaihealthcare.com/ar/صفحه-تجريبيه` and press play. The video
  plays. In DevTools → Network, the `.mp4` is requested only after the click.
- Dashboard → **Website → Pages → any page → Sections → Add section → Video**.
  With *Self*, the form shows **Video file** and **Cover image**. With
  *Youtube* or *Vimeo*, it shows **Link** and **Cover image**.
- **Video file → Choose** lists videos only. Its upload shows a progress bar,
  and a `.mov` file is refused before upload with a message to export it as MP4.

## 4. What changed since `4fb5ad5`

One code commit, `09291e6`, from the prompt of 2026-11-11.

- **CSP** (`server.ts`): `media-src 'self' <API origin>`, and
  `frame-src` adds `www.youtube-nocookie.com` and `player.vimeo.com`. Without
  these, neither a self-hosted video nor a YouTube / Vimeo player could play.
- **Page builder**: media fields read `accept` from the block catalogue, so a
  video field lists and uploads videos only, and a cover field images only.
  The video block shows the file for *Self* and the link for YouTube / Vimeo.
  The field is labelled **Video file**, and the poster **Cover image**.
- **Uploads** (picker and media library): a progress bar, no timeout, one
  upload at a time. Before sending, the client refuses `.mov`, the wrong kind
  and anything over the limit (100 MB for video). The server's own 422 message
  is shown when it refuses a file.
- **Public video block** (already lazy: nothing loads until play): it keeps
  the cover's own shape instead of a fixed 16:9, and the player stays LTR on
  the Arabic page.

We tested the editor against the real block catalogue without saving, with the
upload answered locally. The public block was tested in the browser with a
video section injected, after the CSP fix: the `.mp4` and the YouTube iframe
loaded only on click, and no CSP violation appeared.
