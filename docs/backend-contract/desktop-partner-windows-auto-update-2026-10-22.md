# For the desktop team — what the website does with the version gate (2026-10-22)

You asked what we built on the web side for the Windows Partner download, so
you can line the app's auto-update up with it.

Everything below was measured against production today, not read off a
document. Where we are guessing, it says so.

---

## 1. The short version

The website's download button no longer has a URL written into it. It asks
`GET /api/v1/app/version-gate` and uses the `download_url` that comes back.

That makes **the gate the single source of truth for which build is current**
— for the website, and, if you want it, for the app's updater too. Whatever
the gate says is what a new partner downloads, within seconds of it changing,
with no deploy on our side.

## 2. The call, exactly

```http
GET https://api.hayaihealthcare.com/api/v1/app/version-gate
X-Client-Platform: windows
X-Client-App: com.hayai.partner
```

No token. It answers for any origin — it works from a signed-out marketing
page and from inside the dashboard.

What it returns right now:

```json
{
  "success": true,
  "message": "Version gate retrieved.",
  "data": {
    "platform": "windows",
    "latest_build": 12,
    "force_update": true,
    "version_name": "1.0.1",
    "download_url": "https://get.hayaihealthcare.com/HayaiPartnerSetup-1.0.1.12.exe",
    "sha256": "f441b9b88d5ad976c3582a281d1ec67fa5b64461991dc7e88ecb29b438fcf4e6"
  }
}
```

### ⚠️ The one thing that will bite an updater

**Wrong or missing headers do not produce an error.** They produce a 200 with
an empty object:

```
no headers at all                              → "data": {}
X-Client-Platform: windows (no app header)     → "data": {"platform":"windows"}
X-Client-App: com.hayai.app (the patient app)  → "data": {"platform":"windows"}
X-Client-Platform: android + partner           → "data": {"platform":"android"}
```

So a typo in a header name, or a build that sends the patient app's id, reads
as **"no update information"** rather than as a failure. An updater that treats
a missing `latest_build` as "nothing new" would then never update again, and
nothing anywhere would look broken.

Treat a response without `latest_build` as **an error, not as "up to date"**,
and keep the previous answer rather than acting on an empty one.

## 3. Where those values come from

They are eight settings rows, editable from the dashboard (Settings → app
versions) by anyone with the settings permission. No deploy, no backend
release. We named all eight last week, because two of them used to render as
"latest build" with nothing saying which app they belonged to.

| key | now | type |
|---|---|---|
| `app_version.partner.windows.latest_build` | `12` | build |
| `app_version.partner.windows.version_name` | `1.0.1` | text |
| `app_version.partner.windows.download_url` | `…/HayaiPartnerSetup-1.0.1.12.exe` | text |
| `app_version.partner.windows.sha256` | `f441b9b8…fcf4e6` | text |
| `app_version.partner.windows.force_update` | `true` | optional bool |
| `app_version.partner.windows.min_supported_build` | **empty** | build |
| `app_version.partner.windows.message_en` | **empty** | text |
| `app_version.partner.windows.message_ar` | **empty** | text |

All four filled rows were last written `2026-10-21 12:16:19`, together.

### Two of those empties are worth a decision, and they are yours

1. **`force_update` is `true` while `min_supported_build` is empty.** Those two
   read as a pair: normally the floor says who *must* update and the flag says
   whether being behind is fatal. With no floor set, what does `true` mean for
   a client already on build 12 — nothing, or a forced update loop? We do not
   know how your app reads it, and we are not going to guess on your behalf.
   **If your updater forces whenever `force_update` is true, somebody on the
   latest build is being told to update to it.** Worth ten minutes of checking.
2. **Both message fields are empty**, so any update dialog driven by them has
   no text. If your app expects a message from the gate, it is getting nothing
   today and needs its own default.

## 4. What the backend told us about the release order

Quoting their reply of today, so you have it in one place:

> The gate moves only after the new file is on disk. The desktop team uploads
> the installer first. We check its sha256 on the server, and only then save
> `latest_build`, `version_name`, `download_url` and `sha256` in one write. So
> the gate never names a file that is not there yet.

> The previous installer stays. We do not delete installers when the gate
> moves.

We checked the second claim. Both are served, and both are resumable:

```
HayaiPartnerSetup-1.0.0.11.exe   200 · 17,518,662 bytes · Accept-Ranges: bytes
HayaiPartnerSetup-1.0.1.12.exe   200 · 17,524,348 bytes · Accept-Ranges: bytes
```

`Accept-Ranges: bytes` means a partial download can be resumed rather than
restarted — worth using if your updater downloads 17 MB over a clinic's
connection.

Both are `application/octet-stream` with `X-Content-Type-Options: nosniff`, and
they carry `ETag` and `Last-Modified`, so a conditional request works.

## 5. What the website does with it, exactly

```
href starts at the build this release shipped knowing about
    ↓
version gate answers
    ↓
if download_url starts with "https://get.hayaihealthcare.com/"
    → href becomes download_url
otherwise
    → href is left alone
```

Three deliberate choices, and each one is a request to you in disguise:

1. **The prefix is checked.** A `download_url` on any other host is ignored and
   the button keeps the build it knew. If the installer ever moves to another
   domain or a CDN, **tell us before you move it**, or our button will silently
   keep handing out the old build. This is not something you will see in
   testing.
2. **The gate is read, never required.** If it is unreachable the button still
   works on the last build we shipped with. So a gate outage degrades to "an
   older installer" rather than to a dead button.
3. **The version label under the button is read, never typed.** It says 1.0.1
   because the gate says so.

The button is live now on three pages, in both languages — *How HAYAI works*,
*Insurance coverage* and *About*, at `/ar/…` and `/en/…`. It downloads the
`.exe` directly rather than opening the download page.

## 6. What we need from you

1. **Update the gate in the same release that publishes a new installer**, and
   do not remove the old file until it has moved. The backend says this is
   already the order; this is us saying the website now depends on it.
2. **Tell us before the download host changes.** See §5.1.
3. **Answer the `force_update` / `min_supported_build` question in §3.** It is
   the only thing in here that could be affecting real partners today.
4. If you want the website to show anything else about the build — release
   notes, a "what's new" link, a minimum Windows version — say so. We read the
   gate on every page load already; adding a field costs us nothing.

## 7. What we are *not* doing, so nobody counts on it

- We do not verify the `sha256`. A browser download cannot. The hash is yours
  to check in the installer and in the updater — it is published for you, not
  for us.
- We do not mirror or re-host the `.exe`. Every download comes from
  `get.hayaihealthcare.com`.
- We do not read `force_update`, `min_supported_build` or the messages. Those
  are for your updater; the website only needs the URL and the version label.

---

**Related:** the backend's own notes on this are in
[`api-reply-windows-partner-download-2026-10-21.md`](api-reply-windows-partner-download-2026-10-21.md)
and §5 of
[`api-reply-ai-token-requests-live-2026-10-22.md`](api-reply-ai-token-requests-live-2026-10-22.md).
