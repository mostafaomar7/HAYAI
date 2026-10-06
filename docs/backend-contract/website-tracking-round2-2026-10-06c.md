# Website → backend: round 2 on the measurement spec (2026-10-06)

Your reply landed and we have built against it. Items 1 and 2 are accepted as
written — we are reading `measurement` and sending the full `attribution`
object, and both are verified end to end on our side.

Four things below: one correction about the release, three asks, and the
answers to the two questions you put back to us.

---

## 0. The release is deployed

Your note says **"built and tested, not deployed yet."** It is deployed. We
measured production while reading your reply:

```
GET https://api.hayaihealthcare.com/api/v1/public/en/resolve?path=/
  → "measurement":{"page_sensitivity":"standard","content_group":"home","journey_stage":"know"}

GET .../public/en/search?q=chest+pain
  → "measurement":{"page_sensitivity":"sensitive","content_group":"search","journey_stage":"find"}

GET .../public/en/doctors
  → meta.measurement: standard / doctors / find
```

All three match §18.7 exactly, including the fixed values. We have shipped
against it rather than waiting.

This is the fourth time a release has been described to us as pending when it
was already live. We are not raising it as a complaint — the work is good and
it arrived early. But we now measure the API before acting on a status, and we
would rather you simply told us "live" so we both stop spending time on it. If
there is a staging/production step that makes "deployed" ambiguous from your
side, say so and we will ask differently.

---

## 1. One new field: the value of a confirmed booking

This is not in the spec you were sent. The client added it in their reply.

Google Ads optimises on conversion value. For the three soft conversions —
form, WhatsApp, phone — marketing sets a flat estimate inside Google Ads, so
nothing is needed from either of us. A confirmed booking is different: the
client wants the real number, and they were specific about which number.

> **"الإيراد اللي HAYAI بتاخده من الحجز، مش سعر الكشف اللي المريض بيدفعه"**
> — HAYAI's revenue from the booking, not the consultation price the patient pays.

So we need, on whatever payload represents a confirmed booking:

| Field | Type | Meaning |
|---|---|---|
| `hayai_revenue_egp` | number, EGP | What HAYAI earns on the booking |

- **Our revenue, not the invoice.** Bidding on the gross invoice would make
  Google chase expensive procedures rather than profitable ones.
- **Send it even when it is zero.** We would rather receive `0` than nothing: a
  missing field and a free booking are different facts and we cannot tell them
  apart from the browser.
- **A number, not a string.** `1250`, not `"1250"` and not `"1250 EGP"`. We add
  `"currency": "EGP"` ourselves.
- If it already exists under another name, tell us the name and we will read
  that. We are not asking you to rename anything.

**But read section 3 first.** Your reply says patients do not book through the
website at all, which may mean this field has no home on any website payload.
If that is the case, say so plainly rather than inventing one — the problem is
then the client's conversion model, not your schema, and we will take it back
to them.

### 1b. Is `estimated_total` on the purchase response?

You mention purchases carry `estimated_total` in EGP. §18.4 shows the `201`
returning "purchase object", which we read as including it, but we would rather
confirm than assume: **is `estimated_total` present on the `POST /purchases`
response body?**

If it is, we will send it as the conversion value for `purchase_submitted` and
nothing further is needed for that event. If it is only on the admin detail,
please add it to the public response — a value that arrives after the browser
has gone cannot be attached to the conversion.

Also: you note it is `null` when a line is unpriced. We will send the
conversion without a value in that case rather than sending `0`, since zero and
unknown mean different things to the bidding model. Tell us if you would rather
we did something else.

---

## 2. Our two actions, taken

So you can see the boundary moved.

**`duplicate` gates the conversion push.** Accepted and understood — `200` with
`duplicate: true` means a retry, and only `duplicate: false` pushes
`generate_lead` / `purchase_submitted`. You are right that GA4 would otherwise
count the retry even where Google Ads de-duplicated on `reference`. The
honeypot case is noted: a bot driving a real browser can push one conversion we
cannot distinguish, which we are accepting rather than weakening the honeypot.

**Search `page_location` without `q`.** Agreed and it is a GA4 tag setting on
our side, not an API change. You were right to flag it: marking search
`sensitive` stops the ad tags but GA4 would still have recorded
`?q=chest+pain` in `page_location`, which is exactly the thing §2 forbids. It
goes into the container configuration with the rest of the tag build.

**One thing we fixed that was ours.** We were never sending you a click id.
The server captured `gclid` on the landing page into an HttpOnly cookie — which
is what makes it survive, since Safari expires script-written cookies after
seven days — but HttpOnly also meant our own app could not read it, and the
form posts to you from the browser. Every lead would have been stored with
`utm_*` and no `gclid`, and nothing would have looked broken. Your storage and
your export would have been correct and permanently empty of the one column
they exist for. The server now hands the capture to the page and
`attribution` carries all five click ids plus `first_seen_at`.

We mention it because it is the kind of failure that only shows up months later
as "the data is there but it never matches anything", and it is worth both of
us knowing it was closed before launch rather than after.

---

## 3. The closed loop: you are right, and it is bigger than the export

Your answer to item 3 is the most useful thing in the reply, and we want to
restate it so it is not softened on its way to the owner.

What you said:

- All website leads are **B2B** — contact, hospital partnership, demo, quote,
  purchase inquiry. `converted` means an organisation became a customer.
- **Patients do not book care through website forms.** That happens in the app.
- **Nothing links an app booking back to a website visit or its `gclid`.**

The consequence is not a missing CSV column. It is that **two of the client's
four conversions do not exist on the website**:

| Conversion the client specified | Where it actually happens |
|---|---|
| Lead form | Website — exists, B2B |
| Booking confirmed | **The app. No link to the website visit.** |
| WhatsApp click | Website — a click, not an outcome |
| Phone click | Website — a click, not an outcome |

"Booking Confirmed" is the only one with a real revenue value, and it is the
one the client told us to read from the booking record. If a patient who clicks
an ad, lands on the website, and then books in the app leaves no trace
connecting those three events, then the weekly upload to Google Ads has nothing
to upload, regardless of what the export looks like.

**We are taking this to the client as its own decision**, exactly as you
suggested, framed as two questions: what counts as an outcome worth bidding on,
and whether linking an app booking back to its website visit is work they want
done. We will send you whatever they decide rather than asking you to guess.

Nothing is needed from you on this until then. Two things would help when the
conversation happens, and you may already know the answers:

1. **Does the app know where the patient came from at all?** Any session id,
   install referrer, landing page, anything — even partial. If something
   already exists we would rather build on it than propose a new mechanism.
2. **Is there a shared identity between a website visitor and an app user?**
   A phone number, an email, an account created from the website — any join
   key, even a weak one.

Short answers are fine. "No" is a useful answer and we will not treat it as a
commitment to build anything.

---

## 4. Smaller items

**The three fixed `sensitive` URLs.** Accepted, and the reasoning on
`/doctors/{specialty}` is correct — the specialty is in the URL and every ad
hit carries the URL. They go into the client review as you asked. We expect
them to stand.

**404 handling.** We now classify a 404 as `standard` / `other` / `know` per
§18.7. Note for your records: where `measurement` is absent on a **200** we
render `sensitive`, not `standard`. That is deliberate and it is a backstop
against a future payload regression, not a comment on this release. The two
mistakes do not cost the same.

**Keyword seeding.** Good call on not seeding products — "ICU live
availability" is sold to hospitals and is not a patient ICU page. We will
review the flagged list with the client using
`GET /admin/website/pages?page_sensitivity=sensitive`.

**Editing without republish.** Noted and it matters more than it sounds: an
editor marking a page sensitive stops ad tags on the next request, with no
publish step to forget. Thank you for building it that way.

**`landing_path`.** We send it, and we are glad it is accepted as an alias
rather than a 422.

**Attribution never rejecting a submission.** This was the right fix and we
would not have caught it. A hand-edited campaign URL costing a real lead is the
kind of thing that would have been blamed on the form for months.

---

## Summary of what we need

| # | Ask | Blocking |
|---|---|---|
| 1 | `hayai_revenue_egp` on the booking payload — **if a website booking payload exists at all** (see §3) | The booking conversion value |
| 1b | Confirm `estimated_total` is on the `POST /purchases` response | The purchase conversion value |
| 3 | Two short answers: does the app know its source, and is there a join key | Nothing — background for the client decision |

Everything else in your reply is accepted and built against.
