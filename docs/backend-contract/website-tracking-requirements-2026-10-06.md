# Website → backend: what the measurement spec needs from the API (2026-10-06)

The client sent a Measurement & Tracking Specification — the companion to the
SEO & GEO one. Most of it is browser work and tag-manager configuration, both
ours. Three things are yours, and one thing we checked so you do not have to.

---

## 1. Three per-page fields in the CMS

Every page the website renders has to declare, in its payload, what kind of
page it is editorially. The spec is explicit that these may not be derived
from the URL:

> Why not match URLs: the SEO spec allows transliterated and Arabic-script
> slugs (/ar/al-taghtiya). A URL regex silently misses a renamed or new
> sensitive page; a template-level flag cannot be forgotten, because the page
> does not render without it.

We agree, and we cannot invent these from our side — they are editorial
judgements, and they belong where the editor already works.

| Field | Values | What it decides |
|---|---|---|
| `page_sensitivity` | `sensitive` \| `standard` | **Whether advertising tags are allowed to fire at all.** Emergency, ICU, blood, medical records, AI guidance results, and any form that collects health details are `sensitive`. Analytics still runs; nothing is sent to Google Ads, Meta or TikTok. |
| `content_group` | e.g. `hospitals`, `insurance`, `emergency`, `about` | Groups pages in reporting. Free text from a short fixed list the editor picks from. |
| `journey_stage` | `know` \| `find` \| `act` | Where the page sits in the patient's path, so drop-off can be read. |

Requirements:

- **Present on every page payload** — `resolve` for `kind: page / product /
  doctor / hospital / author`, and in `meta` for listings. A page without
  `page_sensitivity` is the failure case the spec is designed to prevent, so
  please make it non-nullable with a default of `standard` rather than
  omitting it.
- **Editable per page in the dashboard**, next to the SEO fields. The editor
  who adds a symptom-checker page is the person who knows it is sensitive.
- **Defaults are fine to seed**: emergency / ICU / blood / records pages as
  `sensitive`, the rest `standard`. We will review the seeded values with the
  client before ads go live.

Our side renders them into the page before any tag loads, and a CI check fails
the build if they are missing.

## 2. Store the campaign with every lead and purchase

Our server already captures the first set of campaign parameters a visit shows
and keeps it for the visit:

```
utm_source utm_medium utm_campaign utm_term utm_content
gclid gbraid wbraid fbclid ttclid
```

We will send them with the submission. **Please store them on the lead and on
the purchase**, and expose them in the dashboard's lead view and in whatever
export the team uses.

This is what closes the loop in the spec's section 6: weekly, the leads that
actually turned into care are uploaded back to Google Ads against their
`gclid`, so budget moves to the ads that produce patients rather than the ads
that produce form fills. Without the click id stored next to the lead, that
upload is impossible and the whole closed loop is decorative.

Shape — tell us what you would rather receive and we will send that:

```json
{
  "...": "the existing form fields",
  "attribution": {
    "utm_source": "facebook",
    "utm_medium": "paid-social",
    "utm_campaign": "2026-11-waiting-time-cairo",
    "gclid": "Cj0KCQ...",
    "landing_path": "/ar/emergency-icu",
    "first_seen_at": "2026-10-06T14:02:11Z"
  }
}
```

Two notes on handling it:

- These are campaign identifiers, not personal data, but they are tied to a
  person's lead, so they inherit the same retention rules as the lead itself.
- A lead with no `attribution` is normal (direct traffic). Please do not reject
  it.

## 3. Can the lead export carry an outcome?

Section 6 asks for a weekly export of **the leads that reached care**, with
their `gclid`, to upload to Google Ads. That needs two things we do not know
the state of:

1. A way to mark a lead as **attended** (or whatever the team calls "this
   person actually got care"). Does that exist today, in the dashboard or
   anywhere else?
2. An export — CSV is fine — of attended leads with `gclid`, the time, and a
   value in EGP.

If neither exists, say so and we will raise it with the owner as its own piece
of work rather than assuming.

---

## Already confirmed — no action needed

**Form and purchase submissions already return a `reference`.** We checked the
code: both responses carry it and the app already displays it. That is exactly
what the spec needs as `transaction_id` / `event_id`, the id Google Ads
de-duplicates conversions on and Meta/TikTok de-duplicate browser against
server on. We will use `reference` and nothing else needs adding.

Please just confirm it is **stable and unique per submission** — if the same
form submitted twice can produce the same `reference`, say so, because then a
retry would be counted as one conversion rather than two (which may well be
what you intend, but we need to know which).

---

## What is already done on our side

So you know where the boundary is:

- A Content-Security-Policy with a per-request nonce, Report-Only for now.
- First-touch capture in the Node server, including the pre-consent step.
- `data-cta`, `data-section` and `data-clarity-mask` on the templates.
- The language switch no longer drops `gclid` — it used to, which would have
  made ads unattributable for anyone who switched language before answering
  the consent banner.
- `scripts/check-tracking.sh` in CI: nothing hard-coded, the container exactly
  twice, and the install in the right order.

Nothing here changes any API. The three items above are the whole ask.
