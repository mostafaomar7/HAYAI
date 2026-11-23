# Website release `a1d245f` — deploy guide (2026-11-23)

Follows `cfd459a`. Same package shape, **no environment change**: replace the
two folders and restart. Section 2 is the whole job.

The site is server-side rendered: a Node process under Supervisor with nginx
in front, not a folder of static files. Never put it in `public_html`.

**What it is:** the Website 2026 redesign (marketing brief "HAYAI Website
2026 — Developers Only", backend reply of 2026-11-23) and the dashboard
fixes from section 5 of that reply. The API side is already live on
production; this release only needs the API as it is today.

---

## 1. The package

`hayai-web-a1d245f.tar.gz` (also as `.zip`, with identical content):

```
hayai-web/
  browser/     static files (now including fonts/ and brand/)
  server/      server.mjs and its chunks
  RELEASE      a1d245f…
  DEPLOY.md    this file
```

Self-contained: no `npm install`, no `node_modules`. Node 20 or newer.
`browser/` and `server/` must stay side by side.

## 2. Deploy

```bash
cd /tmp && tar -xzf hayai-web-a1d245f.tar.gz

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

If a CDN or nginx cache sits in front of the site, purge it once after the
restart: every page's HTML changed.

## 3. Check

```bash
S=https://hayaihealthcare.com

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/ar     # 200
cat /var/www/hayai-web/RELEASE                                       # a1d245f…

# Self-hosted fonts and brand files are served (all 200)
for f in /fonts/instrument-serif-italic-latin.woff2 /fonts/carlito-400-latin.woff2 \
         /fonts/plex-arabic-700.woff2 /brand/hayai-logo-horizontal.webp \
         /brand/badges/google-play-ar.png /brand/badges/app-store-en.svg; do
  curl -s -o /dev/null -w "%{http_code} $f\n" "$S$f"; done

curl -s "$S/en" | grep -c 'class="emergency-bar"'        # 1
curl -s "$S/en" | grep -c 'fonts.googleapis.com'          # 0
curl -s "$S/en/find-a-doctor?q=test" | grep -o '<meta name="robots"[^>]*>'   # noindex, follow
for u in / /ar /en/icu-emergency /login /dashboard; do curl -sL "$S$u" | grep -c '{{' || true; done   # 0 each
```

**Look at:** `/en` and `/ar` on a phone and a laptop. Expected: a coral
emergency bar on top, a white header with the HAYAI logo, a Navy hero with the
headline in serif italic (second sentence in light blue), and a Navy footer.

## 4. After the deploy: the admin's steps (no code)

The new parts appear as the content and settings allow. Until each step is
done, the page simply shows what it shows today.

1. **Settings → Directory:** turn on `directory.doctors_public`,
   `directory.hospitals_public`, `directory.icu_availability_public`. Owner's
   decision: it publishes the provider directory. Until then the doctor
   search, hospital cards and ICU lists stay hidden.
2. **Settings → Emergency bar:** link page = **467** (ICU & emergency). This
   also tells the website which page shows the live ICU list.
3. **Settings → Organization:** the registered company name (`legal_name`).
   **Settings → App stores:** both store URLs (no URL = no badge).
4. **Menus:** create the menu `home-quick-chips` (EN + AR) for the chips under
   the home search. Regroup `footer`: each top-level item with children is a
   column ("For patients", "For providers", "Company"); items without
   children (Privacy, Terms, Medical disclaimer) form the bottom row.
5. **Hospitals page (#87):** add a **Hospital list** block, or set the
   partner table's anchor to `hospital-directory` (`partners` also works).
   The table then shows only while there are no hospital cards.
6. **Guides page (#38):** set the anchor `guides` on the Article list block
   (adds search and category chips).
7. **Find a doctor (#469):** nothing; its Doctor list block hosts the search.
   **Redirects:** switch off `/en/find-a-doctor → /en/specialties`.
8. **Pages #467 and the medical tourism page:** add a Contact form block with
   `icu-bed-request` / `treatment-plan`. Forms: set `notify_emails` and the
   reply time in the success message.
9. **Contact page (#70):** the form now has a "Reach us directly" card beside
   it; remove the same section from the page text.
10. **About page:** set the Steps block's theme to **brand** for the five
    journey-pillar colours.
11. **Feature grid icons** (optional): an item's `icon` name (e.g. `bed`,
    `pin`, `doctor`, `shield`, `clock`, `wallet`, `heart`, `child`,
    `sparkle`, `apple`) draws a line icon in a pillar colour. A portrait app
    screenshot as the item image shows in a phone frame.

## 5. What changed since `cfd459a`

One code commit, `a1d245f`.

**Website**
- Brand 2026: Navy / Blue / Coral palette; Instrument Serif headings (H1
  italic), Carlito body, **IBM Plex Sans Arabic** for Arabic. All fonts are
  self-hosted (`/fonts`, SIL OFL), so neither the build nor a page load calls
  Google Fonts any more. The two above-the-fold fonts are preloaded per
  language.
- Shell: emergency bar from `site.emergency_bar` (each hotline number is a
  `tel:` link; short text on phones); header with active item; footer columns,
  official store badges, "© year legal name · Tax Reg. No.".
- Blocks restyled per the brief. The hero headline's second sentence is Sky.
  The byline shows only where `show_byline` is true. The GEO answer stays in
  the HTML, collapsed below the fold. Body-only pages get the legal layout
  with "Last reviewed".
- Live widgets, server-rendered: home search + chips + ICU card; doctor
  search, specialty and area grids; hospital filters and cards; ICU list with
  status, update time and "Call to confirm"; guides search and chips;
  hospital page with tabs (tabs without data are hidden; no reviews tab).
  Searched / filtered URLs are `noindex, follow` with the clean canonical. No
  ICU status is ever put in JSON-LD.
- ICU form: the "call 123 first" text in Coral above the submit button. GA4:
  `icu_request_submitted`, `treatment_plan_requested`.

**Dashboard (section 5)**
- Page builder: errors clear as soon as the field is fixed, a failed save
  always says why and scrolls to the field; Statistic items have the "Live
  value" select.
- Links accept `https://`, `/path`, `#anchor`, `mailto:` and `tel:` (also
  `tel:123`).
- Menus: footer columns (max 50 items, 30 children each); the page picker
  searches all pages (`469` or `#469` works).
- Redirects show the API's real message instead of "Validation failed".
- Settings: "Emergency bar" and "App stores" groups; the link page is a page
  picker that can be cleared (sends `null`).
- Leads: the two new types and an "ICU queue" tab.

Tested in the browser at 1440 px and 375 px, EN and AR, against production
reads. The directory widgets were tested with mocked data, since the
directory is private on production. Every dashboard save was intercepted.

Known gap: the App Store badge exists in English only in the repo, so Arabic
pages show the English one (allowed by Apple's guidelines). Google Play has
both.
