# Website → backend: round 3 on the measurement spec (2026-10-09)

Marketing has finished their side: GTM container `GTM-5VKC5CMT`, GA4
(`G-NS1Q07ZLBF` live, `G-EXCKD07VXC` staging), Google Ads `AW-18499939113`
with four conversion actions, Clarity, and the CookieYes banner. The website
side is built against all of it and tested in CI.

What is left of the client's *Measurement & Tracking Specification* that only
the API can do is below. Three asks, one confirmation. Nothing here changes an
existing response shape; every addition is a new field or a new endpoint.

Please answer in the same order, and say **"live"** when something is deployed
to `api.hayaihealthcare.com` — we measure production before building on a
status, as agreed last round.

---

## 1. `care_category` in `measurement` (small)

The spec's §3 and §5 use a `care_category` dimension on leads, searches and
results — `hospital`, `insurance`, `emergency`, … It is an editorial
classification, same family as the three fields you already ship in
`measurement` (§18.7), and for the same reason it may not come from the URL.

**Ask:** add it to the `measurement` block, everywhere that block appears today
(`resolve` for page / product / doctor / hospital / author, `meta.measurement`
on listings).

| Field | Type | Values |
|---|---|---|
| `care_category` | string \| null | `hospital`, `insurance`, `emergency`, `doctor`, `lab`, `pharmacy`, `home_care` — or `null` when it does not apply |

- **Editable per page in the dashboard**, next to `page_sensitivity` /
  `content_group` / `journey_stage`. Same "edit without republish" behaviour.
- **Nullable is fine.** Unlike `page_sensitivity`, a missing `care_category`
  is not a safety problem; it is a reporting gap.
- **Seed it from `content_group`**: `hospitals → hospital`, `insurance →
  insurance`, `emergency → emergency`, `doctors → doctor`, everything else
  `null`. That is exactly what we derive in the meantime, so seeding it the
  same way means nothing changes in the reports on the day you ship.
- If you would rather extend the fixed list, send us the list — we pass the
  value through untouched.

**How we use it:** read from `measurement.care_category` when present, else
the `content_group` mapping above. Pushed on page metadata, `generate_lead`,
`search_results_view`, `no_results`. Never sent to ad tags on sensitive pages.

---

## 2. WhatsApp reference codes (medium — the main ask)

### Why

Spec §8: *"WhatsApp: the pre-filled message carries a short ref code generated
server-side and stored with the session's hayai_ft, so chats in WhatsApp
Business are attributed in the CRM."*

Today a WhatsApp click is counted (Google Ads conversion "HAYAI – WhatsApp
Click", 25 EGP) but the chat that follows is anonymous: nobody can tell which
campaign a WhatsApp conversation came from, so a chat that turns into a
customer cannot be credited to the ad that produced it, and cannot go into the
offline upload in section 3. WhatsApp is the client's main contact channel, so
this is the biggest attribution hole left.

### How it works end to end

```
visitor clicks a WhatsApp button
  └─ browser (synchronously, in the click handler — no waiting):
       1. generates ref  "H-7K3Q9MX"
       2. appends it to the wa.me ?text=   → "…\n\nرقم المرجع: H-7K3Q9MX"
       3. navigator.sendBeacon(POST /whatsapp-refs, {ref, attribution, …})
       4. lets the click proceed → WhatsApp opens with the code in the message
  └─ API stores ref → attribution
sales agent sees "H-7K3Q9MX" in the chat
  └─ dashboard: look up the ref → see the campaign / gclid
  └─ "Create lead from this chat" → a normal lead, carrying that attribution
```

The code is generated **in the browser**, not fetched from you, on purpose: a
WhatsApp link must open inside the click itself. Waiting for an API round trip
before opening it gets the window blocked by mobile Safari and adds delay on
the exact tap that converts (the spec forbids holding these clicks). So the
browser invents the code and tells you about it with a beacon that cannot
delay navigation.

### Endpoint 1 — record a ref (public)

```
POST /api/v1/public/{locale}/whatsapp-refs
Content-Type: text/plain;charset=UTF-8      ← sendBeacon cannot set JSON; body is JSON text
```

```json
{
  "ref": "H-7K3Q9MX",
  "page_path": "/ar/تغطية-التأمين",
  "cta_tracking_key": "cta.whatsapp-sales",
  "attribution": {
    "utm_source": "facebook", "utm_medium": "paid-social", "utm_campaign": "2026-11-waiting-time-cairo",
    "utm_term": null, "utm_content": null,
    "gclid": "Cj0KCQ…", "gbraid": null, "wbraid": null, "fbclid": null, "ttclid": null,
    "landing_path": "/ar", "first_seen_at": "2026-10-09T14:02:11Z",
    "session_id": "…", "page_id": 1, "cta_tracking_key": "cta.whatsapp-sales"
  }
}
```

`attribution` is **exactly the object we already send with form and purchase
submissions**, same keys, same validation. Please reuse that code path.

Requirements:

- **Accept `text/plain`** and parse the body as JSON. `sendBeacon` with a
  `Blob` of type `application/json` triggers a CORS preflight, which a beacon
  does not wait for, so the request would be dropped. `text/plain` is a simple
  request and goes straight through.
- **CORS:** allow origin `https://hayaihealthcare.com` (and `www.`), no
  credentials needed.
- **Response:** `204` (or `202`). The browser never reads it.
- **`ref` format:** `^H-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$` — 7 characters
  from an alphabet with no `0/O/1/I/L`, because an agent will read it off a
  phone screen and type it. ~27 billion codes.
- **Idempotent on `ref`:** the same ref posted twice (double tap, beacon
  retry) is one record, first write wins, still `204`.
- **Never reject on attribution.** Same rule as forms last round: a malformed
  campaign value is dropped, not a 422. A lost ref is a lost attribution; a
  lost click is worse.
- **Rate limit** per IP like the forms endpoint (e.g. 30/min). Over the limit,
  `204` anyway and drop it — the visitor must not notice.
- **Retention:** same as leads' attribution (90 days is what the spec uses for
  the first-touch cookie and what Google Ads accepts for a click upload).
- **No personal data in this record.** It holds campaign ids and a path, not a
  phone number. The phone number arrives later, inside WhatsApp, and only
  joins this record when an agent creates a lead from it.

### Endpoint 2 — look up a ref (admin)

```
GET /api/v1/admin/website/whatsapp-refs/{ref}
→ 200 { "ref", "created_at", "page_path", "cta_tracking_key", "attribution": {…}, "lead_id": null }
→ 404 when unknown
```

Case-insensitive, and tolerant of a missing `H-` prefix — agents will type
`7k3q9mx`.

### Endpoint 3 — turn a chat into a lead (admin)

```
POST /api/v1/admin/website/whatsapp-refs/{ref}/lead
{ "name": "…", "phone": "…", "notes": "…" }
→ 201 { lead object }
```

Creates a normal website lead (`type: "whatsapp"`, or whatever fits your enum)
with the ref's `attribution` copied onto it, and sets `lead_id` on the ref so
it cannot be converted twice (second call → `409` with the existing
`lead_id`). From there it is a lead like any other: statuses, `converted`, and
the export in section 3.

If you would rather do this as a `whatsapp_ref` field on the existing
create-lead endpoint, that is fine — tell us which, and we build the dashboard
screen against it.

### What we build on our side once 1–3 are live

- The click handler on every `wa.me` link (CMS buttons and the footer number)
  — ref, message text, beacon. The GTM click trigger keeps counting the click
  exactly as today; the link stays a real link.
- A "WhatsApp ref" search box in the dashboard's Leads screen, with "Create
  lead" on the result.

---

## 3. Export for the Google Ads offline upload (medium)

### Why

Spec §6, the closed loop: weekly, the leads that became real customers are
uploaded back to Google Ads against their `gclid`, so the budget moves to the
ads that produce customers rather than form fills. Last round you confirmed
that leads are B2B and `converted` means the organisation became a customer.
That is the outcome to upload. The `gclid` is already stored on every lead and
purchase.

### Ask

```
GET /api/v1/admin/website/conversions/google-ads.csv?from=2026-10-01&to=2026-10-07
Authorization: admin token, same as the other admin endpoints
→ 200 text/csv; charset=utf-8
```

Exactly Google's click-conversion template, so marketing uploads the file as is
(Google Ads → Goals → Conversions → Uploads):

```csv
Parameters:TimeZone=Africa/Cairo
Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
Cj0KCQjw…,Attended (offline),2026-10-05 14:30:00,5000,EGP
```

Rules:

| Column | Source |
|---|---|
| Google Click ID | `attribution.gclid` of the lead / purchase. **Rows without a gclid are skipped.** |
| Conversion Name | `Attended (offline)` — the action name marketing creates in Ads. Make it a setting or a `?name=` param, not a constant buried in code. |
| Conversion Time | The moment the status became `converted` (from the status history), in Africa/Cairo, `yyyy-MM-dd HH:mm:ss`. The `Parameters:TimeZone` line makes Google apply the right offset, including summer time — no `+0200`/`+0300` arithmetic needed on your side. |
| Conversion Value | The deal value in EGP if leads carry one; else the purchase's `estimated_total`; else empty. Plain number, no thousands separator. |
| Conversion Currency | `EGP` |

- **Which rows:** leads **and** purchases whose status changed to `converted`
  (or your equivalent for purchases — tell us the name) inside `from`–`to`.
- **Skip clicks older than 90 days** at conversion time — Google rejects them
  and fails the row.
- **One row per lead**, even if it bounced in and out of `converted`: use the
  first time it reached it.
- A **"Download for Google Ads"** button on the dashboard's Leads screen (we
  build it) calls this with the last 7 days by default.

If leads have no value field and you think they should, say so — that is the
client's call and we will ask.

---

## 4. Confirmations (no work if the answer is yes)

1. **`estimated_total` on the `POST /purchases` response** (round 2, 1b).
   We send it as the value of `purchase_submitted`. If it is only on the admin
   detail, the purchase conversion has no value.
2. **`reference` is unique per submission** (round 1). It is now also our
   `event_id`, which Meta and TikTok de-duplicate on; a shared reference across
   two real submissions would merge two conversions.

---

## Not asked — for your records

- **Booking conversion (`hayai_revenue_egp`)**: still waiting on the client's
  decision about app bookings (round 2, §3). Nothing to do.
- **Hashed e-mail / phone for enhanced conversions**: the client turned it off
  for health-data reasons. The API never needs to hash or send these.
- **A test mode for the lead endpoint**: not needed. Our CI tests answer the
  form request inside the browser, so no test lead ever reaches you.

## Summary

| # | Ask | Size | Unblocks |
|---|---|---|---|
| 1 | `care_category` in `measurement`, editable, seeded | small | A real dimension instead of our fallback |
| 2 | WhatsApp refs: public beacon endpoint, admin lookup, create-lead | medium | Attribution of WhatsApp chats (§8) |
| 3 | Google Ads offline-upload CSV of converted leads/purchases | medium | The closed loop (§6) |
| 4 | Two yes/no confirmations | — | Purchase value; de-duplication |
