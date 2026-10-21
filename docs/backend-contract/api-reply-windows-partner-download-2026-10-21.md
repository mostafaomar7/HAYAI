# Reply — the Windows Partner download (2026-10-21)

Measured everything in your note against production before building. Four of
your five points check out exactly. One wording correction, one thing you did
not mention that was already half-built on our side, and one question that
decides whether this needs a release at all.

## 1–5, measured

| your point | result |
|---|---|
| the page is live, valid certificate | `https://get.hayaihealthcare.com` → **200**, TLS verifies, no redirect |
| the filename carries the version | confirmed — the gate points at `HayaiPartnerSetup-1.0.1.12.exe` |
| the gate is public, no token | confirmed — answers with no `Authorization` header |
| `data.download_url` / `data.version_name` | both present |
| do not re-host the `.exe` | understood; we will not |

The gate returns more than the two fields you named, which is useful to have
written down:

```json
{ "platform": "windows", "latest_build": 12, "force_update": true,
  "version_name": "1.0.1",
  "download_url": "https://get.hayaihealthcare.com/HayaiPartnerSetup-1.0.1.12.exe",
  "sha256": "f441b9b8…fcf4e6" }
```

## One correction: it is not `Access-Control-Allow-Origin: *` for us

You wrote the gate is "CORS-open (`Access-Control-Allow-Origin: *`)". It is —
for every origin **except ours**:

```
Origin: http://localhost:4200          →  Access-Control-Allow-Origin: *
Origin: https://get.hayaihealthcare.com →  Access-Control-Allow-Origin: *
Origin: https://example.com            →  Access-Control-Allow-Origin: *
Origin: https://hayaihealthcare.com    →  Access-Control-Allow-Origin: https://hayaihealthcare.com
                                          Access-Control-Allow-Credentials: true
```

Our site is on the API's allow-list, so it gets the credentialed variant
instead of the wildcard. **Both work**, and the preflight is correct
(`Allow-Methods: GET`, `Allow-Headers: x-client-platform,x-client-app`,
`Max-Age: 86400`). Nothing to change — flagging it only so that whoever tests
from the live site and sees a different header than your note promises does
not go hunting for a problem.

## The part you did not mention: it is already in platform settings

`GET /admin/settings` already carries the whole Windows block — **eight keys**,
not the five the mobile apps have:

```
app_version.partner.windows.min_supported_build   null
app_version.partner.windows.latest_build          12
app_version.partner.windows.force_update          true
app_version.partner.windows.message_en / _ar      null
app_version.partner.windows.version_name          "1.0.1"
app_version.partner.windows.download_url          "https://get.hayaihealthcare.com/HayaiPartnerSetup-1.0.1.12.exe"
app_version.partner.windows.sha256                "f441b9b8…"
```

So the version, the link and the digest are **already editable by an admin in
our Settings screen**, and the gate reads them. That is a better arrangement
than your note implies: nothing on our side needs to be typed in or
hard-coded, because the dashboard is where they are typed in.

**We fixed one thing there.** Our Settings page names switches from the API,
falling back to the last two segments of the key when we have no translation.
So these eight arrived reading **"Windows · Latest build"**, sitting directly
beneath **"Partner app — latest build on the store"** (the mobile one). Two
rows called "latest build", one of them not saying which app it belongs to —
an easy way to set the wrong one. They now read "Partner app (Windows) — …" in
both languages. That is on `main`.

## The question: where do partners actually look?

Your point 5 says "put it where partners look, not on the patient-facing
side". We measured what we have, and the honest answer is **we have no
partner-facing surface on the web**:

- The public site is six published pages — About, Emergency & ICU, How it
  works, FAQ, Home, Insurance coverage. All patient-facing.
- The root `/` is still the holding page; the marketing site is parked.
- The dashboard is admin-only (`user_type === 'admin'`), so a clinic, hospital
  or doctor never reaches it. **It is not where partners look.**

So the button needs a home, and there are two shapes:

**(a) Content only — no release, can be live today.** The CMS already has a
`cta` block (heading, body text, a link) and our site already renders it. An
admin creates a partner page, drops in a `cta` block pointing at
`https://get.hayaihealthcare.com`, and puts your SmartScreen line in the body
text:

> "Windows may show a blue 'Windows protected your PC' screen. Click More
> info, then Run anyway."

This satisfies your points 1, 3, 4 and 5 exactly — it links to the page, never
mirrors the `.exe`, carries the warning, and sits wherever the admin puts it.
It does **not** show the live version number.

**(b) The version shown live — needs one thing from you.** Block types are
served by `GET /admin/website/blocks`, your catalogue, 27 of them. We cannot
add one from our side: an unknown type would not be offered in the page
builder and would not validate. So if you want a block that calls the gate and
prints "Version 1.0.1" next to the button, **add the type to the catalogue**
and we will render it. Something like:

```
type: app_download
fields: heading(text), text(textarea), platform(select: windows),
        app(select: com.hayai.partner)
```

— no url field, because the whole point is that it reads `download_url` and
`version_name` from the gate rather than being typed in.

**Our recommendation: (a) now, (b) only if the version number matters.** The
version is already on `get.hayaihealthcare.com` itself, which is one click
away, so (b) buys a little and costs a release on both sides.

## What we need to know

1. **(a) or (b)?** If (a), nothing more is needed from us — this is a content
   task and no release is involved.
2. **Which page, and should it be indexed?** Our SEO gate runs over the public
   site, so a new page needs a title, a description and a direct answer in both
   languages. If this page should be reachable but not in search results, say
   so and we will mark it.

## Still open from before

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74.
- [`api-reply-two-areas-live-2026-10-19.md`](api-reply-two-areas-live-2026-10-19.md)
  — the guidelines-only admin check on `/admin/doctor/subspecialties`, and
  whether an admin account can be deleted rather than only deactivated.
