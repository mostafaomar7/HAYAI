# Backend → website: measurement round 3 — reply (2026-10-09)

Copy of the backend team's answer to `website-tracking-round3-2026-10-09.md`,
kept here because the website is built against it. Live as `43ef6ed` on
api.hayaihealthcare.com. Full contract on their side:
`docs/frontend/website-cms-dashboard-api.md` §2.4, §7.1, §7.2, §18.7, §18.8.

## What the website relies on

1. **`measurement.care_category`** is always present: `hospital`, `insurance`,
   `emergency`, `doctor`, `lab`, `pharmacy`, `home_care`, or `null`. **`null` is
   an answer** (an editor may clear it on purpose) — the website keeps it and
   only falls back to the `content_group` mapping when the key is missing.
   Open question for the client: the ICU directory is `null`; `hospital` or
   `emergency` if they prefer.

2. **`POST /api/v1/public/{locale}/whatsapp-refs`** — `text/plain` or JSON body
   `{ ref, page_path, cta_tracking_key, attribution }`; always `204` (also over
   the 30/min limit); idempotent on `ref`; `422` only for a missing or malformed
   `ref`; CORS `*`. Codes never converted are deleted after 90 days.

3. **`GET /api/v1/admin/website/whatsapp-refs/{ref}`** (leads.view) —
   case-insensitive, spaces and `H-` optional; `404` when unknown. Returns
   `ref, created_at, locale, page_path, cta_tracking_key, attribution, lead_id,
   lead_reference`. Attribution keys are the lead's (`landing_page`, not
   `landing_path`).

4. **`POST /api/v1/admin/website/whatsapp-refs/{ref}/lead`** (leads.update) —
   `{ name?, phone, email?, organization?, notes? }`, `phone` required; `201`
   with the lead (`type: "whatsapp"`, `whatsapp_ref`, assigned to the agent);
   `409` with `errors.lead_id` / `errors.lead_reference` when already
   converted. There is no other admin create-lead endpoint.

5. **`GET /api/v1/admin/website/conversions/google-ads.csv?from&to`** (leads.view
   + orders.view) — Google's click-conversion template with
   `Parameters:TimeZone=Africa/Cairo`; no dates = last 7 days. Leads at first
   `converted`; purchases at `completed` (not `approved`). Value =
   `estimated_total` for purchases, empty for leads. One row per click ever —
   the Ads action must count **One**. Rows without a `gclid` are skipped
   (gbraid/wbraid-only iOS rows on request). Conversion name from the
   `google_ads.conversion_name` setting, default `Attended (offline)`.

6. **Confirmed:** `estimated_total` is on the `POST /purchases` response
   (decimal string, `null` when unpriced); `reference` is unique per table and
   only repeats on a `duplicate: true` replay.

## Open decisions for the client

- ICU directory `care_category` (`null` today).
- A `deal_value` on leads, so converted leads carry a value in the Google Ads file.
- Whether to include gbraid/wbraid-only (iOS) rows in the upload.
