# Website → backend: follow-up on the measurement asks (2026-10-06)

Three things, in order of how much they are blocking:

1. **You already shipped item 1 and did not tell us.** We found it by
   measuring. Thank you — it is correct, including the judgement calls.
2. **One new field**, asked for by the client after the original spec: the
   revenue on a booking.
3. **Items 2 and 3 of the previous note are still open**, and one of them is
   now the only thing standing between us and a working conversion loop.

---

## 1. `measurement` — shipped, correct, now live on our side

We asked for `page_sensitivity`, `content_group` and `journey_stage`. They are
in the resolve payload already:

```json
"measurement": {
  "page_sensitivity": "standard",
  "content_group": "home",
  "journey_stage": "know"
}
```

We checked every page in the English sitemap. The classification is not just
present, it is right:

| Page | `page_sensitivity` | `content_group` |
|---|---|---|
| `/en` | `standard` | `home` |
| `/en/emergency-icu` | **`sensitive`** | `emergency` |
| `/en/doctors/critical-care` | **`sensitive`** | `doctors` |
| `/en/insurance-coverage` | `standard` | `insurance` |
| `/en/doctors` | `standard` | `doctors` |

Both of the pages that should be sensitive are, and the one that is a facet of
a listing — `critical-care` — inherited it correctly rather than falling back
to the listing's own value. That is the case we were most worried about.

It is wired up: the server now renders these into the dataLayer before any tag
can read them, and `scripts/check-tracking.sh` passes on all eleven pages.

**One request, so it stays right.** Please make sure a newly created page
cannot be saved without `page_sensitivity`, and that the field is visible to
the editor next to the SEO fields. The failure mode is not a missing field
today — it is the symptom-checker page somebody adds in March. Our side renders
an unclassified page as `sensitive` and the build gate fails, so nothing
leaks; but that is a backstop, not a substitute for the editor seeing the
field.

---

## 2. New: the revenue on a booking

This is not in the spec you were sent. The client added it in their reply, and
it is the one conversion value that is not a marketing estimate.

Google Ads optimises on conversion value. For the three soft conversions —
form, WhatsApp, phone — marketing sets a flat estimate inside Google Ads, so
nothing is needed from either of us. **A confirmed booking is different: it has
a real number, and the client wants the real number.**

So we need, on the booking / purchase payload:

| Field | Type | Meaning |
|---|---|---|
| `hayai_revenue_egp` | number, EGP | **What HAYAI earns on the booking** — not the price the patient pays the provider |

Three notes, because the distinction matters more than the plumbing:

- **It is our revenue, not the invoice.** The client was explicit. Bidding on
  the gross invoice would make Google chase expensive procedures rather than
  profitable ones.
- **Send it even when it is zero.** We would rather receive `0` than nothing —
  a missing field and a free booking are different facts, and we cannot tell
  them apart from the browser. The client has said they will backfill the real
  numbers from the bookings side; the install does not wait for that.
- **A number, not a string.** `1250`, not `"1250"` and not `"1250 EGP"`. We
  add `"currency": "EGP"` ourselves.

If the field already exists under another name, tell us the name and we will
read that instead — we are not asking you to rename anything.

---

## 3. Still open from the previous note

### 3a. Store the campaign parameters with every lead and purchase

**This is now the blocking one.** Our server captures the first campaign
parameters a visit shows and holds them for the visit. We send them with the
submission. They need to be stored on the lead and on the purchase, and visible
in the dashboard's lead view.

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

Why it cannot be skipped: weekly, the leads that actually turned into care get
uploaded back to Google Ads against their `gclid`, so budget moves to the ads
that produce patients rather than the ads that produce form fills. Without the
click id stored next to the lead that upload is impossible, and the closed loop
in section 6 of the spec is decorative.

A lead with no `attribution` is normal — that is direct traffic. Please do not
reject it.

### 3b. Can the lead export carry an outcome?

Two things we still do not know the state of:

1. A way to mark a lead as **attended** — "this person actually got care".
   Does that exist today, in the dashboard or anywhere else?
2. An export — CSV is fine — of attended leads with `gclid`, the timestamp,
   and a value in EGP.

If neither exists, say so plainly and we will raise it with the owner as its
own piece of work rather than quietly assuming it is coming.

### 3c. One confirmation on `reference`

Form and purchase submissions already return a `reference`, and the app
displays it. That is what the spec needs as `transaction_id` — the id Google
Ads de-duplicates conversions on. We are using it and nothing needs adding.

Please just confirm it is **stable and unique per submission**. If the same
form submitted twice can produce the same `reference`, say so — a retry would
then be counted as one conversion rather than two, which may well be what you
intend, but we need to know which.

---

## For reference: what is done on our side

So you know where the boundary is and do not build any of it twice.

- The tracking install in the head, in the order Consent Mode requires:
  consent defaults (all denied) → page metadata → container. Built by the Node
  server, so a template edit cannot reorder it.
- `measurement` rendered into the dataLayer before any tag loads, with an
  unclassified page failing closed to `sensitive`.
- Internal traffic marked by a `hayai_team` cookie rather than by IP address,
  because Egyptian consumer lines are dynamic — `?hayai_team=1` to opt a device
  in, `?hayai_team=0` to opt out.
- First-touch campaign capture in the server, including the pre-consent step,
  as an HttpOnly cookie. Safari caps script-written cookies at seven days,
  which would lose most iPhone attribution before the patient converts.
- A Content-Security-Policy with a per-request nonce, Report-Only for now.
- `data-cta`, `data-section` and `data-clarity-mask` on the templates.
- `scripts/check-tracking.sh` in CI: nothing hard-coded, the container exactly
  twice, the install in the right order, and the classification genuinely from
  the payload rather than from our fallback.

Nothing above changes any API. Items 2, 3a, 3b and the confirmation in 3c are
the whole ask.

---

## One correction, for your records

Our domain is **`hayaihealthcare.com`**. `hayai.app` appears in the older API
documentation and in a reply that went round this week; it does not resolve.
Anywhere a URL is built — canonicals, `live_url`, `preview_url`, the sitemap
index — `hayaihealthcare.com` is the one. The live responses are already
correct, so this is about the docs and anything new, not a bug report.
