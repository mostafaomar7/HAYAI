# Website release `4e744c2`

A release, not a new install — step 11 of the go-live runbook. Nothing in the
server setup changes: same Supervisor program, same environment, same nginx.

Attached: `hayai-web-4e744c2.tar.gz` (3.3 MB, `browser/` + `server/`).

```bash
sudo tar -xzf hayai-web-4e744c2.tar.gz -C /var/www/hayai-web
sudo chown -R www-data:www-data /var/www/hayai-web
sudo supervisorctl restart hayai-web
```

The restart is the part that matters. The extract alone changes nothing — Node
holds the old `server.mjs` in memory until the process is replaced.

## One check afterwards

```bash
curl -s https://hayaihealthcare.com/en/emergency-icu | grep -c 'class="da"'
```

**Expect `1`.** It is `2` today — that is the bug this release fixes, and it is
the quickest way to tell whether the restart took.

If it still says `2`, the process did not restart rather than the build being
wrong.

## What changed

Website-only. No API calls changed, no new environment variables, nothing is
needed from Laravel.

- **The direct answer was rendered twice** on four of the five content pages —
  once from `geo.direct_answer` after the H1, and again from a `direct_answer`
  block with the same text. A patient reading the emergency page saw the same
  paragraph twice, and crawlers read duplicated body copy on the page the SEO
  spec cares most about.

- **Conversion events now reach the dataLayer.** Nothing the app did ever did:
  every event went to `/events`, which is a different question from what the
  tag manager reads. The container could have been installed correctly and
  reported page views and not one conversion.

- **The page classification was going stale after the first page.** The server
  renders `measurement` once, before any tag can read it, and then the router
  takes over with no second render. A patient landing on the home page and
  opening `/en/emergency-icu` kept `page_sensitivity: standard` — and the
  advertising tags read exactly that key to decide whether they may fire. They
  would have fired on the ICU page, which is the one thing section 2 of the
  measurement spec exists to prevent, and nothing would have looked wrong.

- **A retry no longer counts as a second conversion**, using the `duplicate`
  flag exactly as you specified it.

- **The first-touch click id reaches the API.** This was ours and it was
  silent: the server captured `gclid` into an HttpOnly cookie, which is what
  makes it survive Safari's seven-day cap, but HttpOnly also meant our own app
  could not read it, and the form posts to you from the browser. Every lead
  would have been stored with `utm_*` and no click id — your storage and your
  export correct and permanently empty of the one column they exist for.

## Rollback

Keep the previous tarball. Same three commands with the old file.
