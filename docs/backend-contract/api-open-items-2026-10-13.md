# Everything still open on the API — one list

> **All eight are answered and live as of 2026-10-14.** Confirmed against
> production item by item in `api-open-items-reply-2026-10-14.md`. This file
> stays as the record of what was asked.


**Dashboard → backend, 2026-10-13.** This replaces nothing; it gathers what is
still outstanding across `qa-round-api-items-2026-10-13.md`,
`qa-round-api-reply-2026-10-13.md` and
`perf-preflight-and-avatars-2026-10-13.md` into one place, so there is a single
file to work from.

**Nothing here has been answered yet.** Everything you have already shipped —
the owner fields on adverts, `redirect_link` validation, HSTS, the preflight
max-age, the avatar resize, the `/storage/profiles` cache header — is closed
and is not repeated. Thank you for those; items 1, 2, 3, 4, 6 and 7 of the
original list are done.

Every measurement below was taken against production on 2026-10-13 with the
`admin@hayai.com` account. Anything created while probing was deleted
afterwards and the lists were re-read to confirm it.

---

## At a glance

| # | was | Item | Why it matters |
|---|---|---|---|
| 1 | 10 | advert `status` is never expired | **five finished adverts may still be serving** |
| 2 | 12 | duplicate derived category slug returns 500 | the admin sees "Server error", no field named |
| 3 | 14 | published settings accept any string | `bad-email` was stored as the public contact address |
| 4 | 8 | `optional_bool` accepts any string | the switch that can lock every app user out |
| 5 | 5 | option lists accept duplicate names | doctors pick a specialty by coin toss |
| 6 | 9 | advert `search` matches only the owner | a title cannot be searched for |
| 7 | 11 | no `Timing-Allow-Origin` | we see that an API call was slow, not why |
| 8 | 13 | a CTA placement cannot be removed | no value clears it once set |

Items 1 to 4 can produce a wrong answer to a real user. Items 5 to 8 cost
people time.

**One question, not an item.** Advertisement 6, "20% Off General Checkups",
created 2026-09-26, before your audit log and before any logging of ours. You
proved adverts 1, 2, 3 and 5 have the right owner; 6 is the one nobody can
place. Was it meant for "kareem alaa eldeen" (user 7, where it is now) or for
"test name" (doctor row 7, user 44)? **If nobody remembers, our recommendation
is to leave it alone** — "kareem alaa eldeen" is a real account, and moving it
to the wrong one is the same mistake again in the other direction.

---

## 1. An advertisement's `status` is never expired

*(was item 10)*

BUG-27. The QA round asked why a finished advert looks the same as a running
one in the dashboard. We went to put a badge on the card and found that the
field it would come from does not mean what its name says. Measured on
2026-10-13:

```
id  status   is_published   start_date    end_date
 6  active   true           2026-09-26    2026-09-30
 5  active   true           2026-09-06    2026-09-23
 3  active   true           2026-08-28    2026-08-28
 2  active   true           2026-08-27    2026-08-27
 1  active   true           2026-08-26    2026-08-27
```

Every one of them ended — the most recent a fortnight ago — and every one of
them still reports `active`. And:

```
GET /admin/advertisements?status=active    -> 5 results
GET /admin/advertisements?status=expired   -> 0 results
```

So `status` is a flag that is written once and never recomputed, and the
`expired` filter the dashboard offers can never match a row.

Our badge is worked out from `start_date` and `end_date` instead, because those
are facts: the cards now read **Expired** where `status` says active. That is a
display decision and it does not answer the question that matters:

**What we need to know:** do the patient and partner apps decide what to show
from `status`, or from the dates? If from `status`, five advertisements that
finished in August and September are still being served, and that is the real
bug here rather than a missing badge.

**What we are asking for either way:** `status` computed from the dates — or
dropped from the response, so nothing can read it and be wrong.

---

## 2. A duplicate category slug returns 500 when the slug was derived

*(was item 12)*

The same collision gives two completely different answers depending on whether
we sent the slug or let you derive it. Measured on production, 2026-10-13:

```bash
# we send the slug ourselves
POST /admin/website/categories {"kind":"product","name_en":"ZZ different name",
                                "slug_en":"zz-probe-unique-20261013"}
422 {"errors":{"slug_en":["The slug en has already been taken."]}}      correct

# we leave it blank and you derive it from the name
POST /admin/website/categories {"kind":"product","name_en":"ZZ probe unique 20261013"}
500 {"message":"Server error. Please try again later."}                 the bug
```

The derived slug skips the uniqueness rule and the unique index raises instead.
The admin gets a red box saying "Server error. Please try again later." with no
field marked and nothing to act on, which is how it reached QA as a bug.

**What we would like:** the derived slug validated the same way the sent one is,
so this answers 422 with `slug_en` named. Appending `-2` instead would also be
defensible, but a 422 is better — the admin chose that name and should be told
it is taken rather than quietly given a different address.

Our form now predicts the collision and blocks it before you are asked, against
the list already on screen. That covers the common case, not two admins saving
at once, and it only works because our slug derivation matches yours — checked
over accents, apostrophes, punctuation, underscores and repeated spaces, seven
samples, byte-identical on both sides. We would rather not depend on that
staying true.

Slugs are unique per `kind`, which we confirmed by creating "ZZ Kind Probe" as
both a product and an article category. Our check is scoped the same way.

---

## 3. Settings published on the website accept any string

*(was item 14)*

`organization.email` is typed `"string"` and stored without a format check. On
2026-10-12 `bad-email` was saved through the dashboard and the form reported
"Settings saved". That value is rendered in the site footer and in the
Organization schema that search engines read.

```json
{"key":"organization.email","type":"string","value":"islam@hayaihealthcare.com",
 "description":"Public contact email."}
```

**Asked for:** a real type on the keys that are published — `email` for
`organization.email`, `phone` for `organization.phone` and
`organization.whatsapp`, `url` for the legal links — and a 422 when the value
does not fit. The `type` field already exists in your payload and we render
from it; it is the value of `type` that is wrong, not the mechanism.

We have added the same checks on our side, keyed by setting name rather than by
`type` precisely because `type` is the part that is wrong. They are a guard at
the keyboard, not a boundary: anyone can still PATCH the value with curl.

---

## 4. `optional_bool` settings accept any string

*(was item 8)*

BUG-30. `app_version.*.force_update` is typed `optional_bool` and has three
meanings: `true` forces an update, `false` is an emergency switch that unblocks
everybody including builds below the minimum, and empty leaves the decision to
`min_supported_build`.

`PATCH /admin/settings` takes whatever is sent. Measured on 2026-10-13 against
`app_version.patient.force_update`, which was empty before and after — we set
it back the moment we saw it had been stored:

```
{"app_version.patient.force_update": "true"}   -> 422, but on the business rule
                                                  ("needs latest_build or
                                                  min_supported_build"), so the
                                                  string was already read as true
{"app_version.patient.force_update": "false"}  -> 200, stored
{"app_version.patient.force_update": "no"}     -> 200, stored
{"app_version.patient.force_update": "0"}      -> 200, stored
```

None of those three is a boolean, and none was refused. The dashboard was part
of the problem — the field had no control of its own, so it was edited as free
text — and that is fixed: it is a three-state select now and sends `true`,
`false` or `null` and nothing else.

**What we are asking for:** refuse anything that is not a boolean or null, with
a 422. The apps and any script post here too, and this is the setting that
decides whether every user of an app is locked out of it until they update.

Worth confirming separately: that `"no"` and `"0"` were each read as `false`
rather than as PHP truthiness. We did not keep probing, because every probe
writes.

---

## 5. Option lists accept duplicate names

*(was item 5)*

BUG-29. Only `code` is kept unique; the names are not checked at all.
Reproduced on 2026-10-13 against the live API with a throwaway row, since
deleted — the same body posted twice, identical in both languages:

```
POST /admin/doctor/specialties  {"name_en":"ZZ Duplicate Probe","name_ar":"فحص التكرار"}
    -> id 33, code "zz_duplicate_probe"

POST /admin/doctor/specialties  {"name_en":"ZZ Duplicate Probe","name_ar":"فحص التكرار"}
    -> id 34, code "zz_duplicate_probe_2"      ← accepted
```

The suffix keeps the database happy and leaves the doctor signup form offering
the same specialty twice, with nothing on screen to tell them apart. Whichever
one a doctor picks is a coin toss, and the two then report separately.

The dashboard now checks every name against the whole list before saving, in
both languages. That is a form guard and no more: two admins saving at the same
moment still get through, and so does anything posted with curl.

**What we are asking for:** a unique index on the name columns, per list, and a
422 rather than a silent `_2`. It applies to every list behind
`/admin/doctor/specialties`, `/admin/doctor/subspecialties` and the rest of the
option lists, not only this one.

---

## 6. Advertisement search only matches the owner's name

*(was item 9)*

BUG-19. `GET /admin/advertisements?search=` looks at one field. Measured on
2026-10-13 against the five live adverts — advert 5 is titled "Test",
described "Hdhdus ssbjj", owned by "clinic 22" and links to
`https://youtu.be/G0RCe4YQzwo`:

```
search=clinic 22   -> 1 result  (advert 5)    <- the owner's name
search=Test        -> 0 results               <- its own title
search=Hdhdus      -> 0 results               <- its own description
search=youtu.be    -> 0 results               <- its own link
search=20%         -> 0 results               <- advert 6's title
```

The QA report filed it as "search doesn't match visible link text", and until
today the link was the only text on the card, so the one thing on screen was
the one thing not searched. We have put the title and the owner on the card,
which makes the search at least consistent with what is shown — but a title
still cannot be searched for, and a title is what an advert is called.

**What we are asking for:** `search` over `title`, `description` and
`redirect_link` as well as the owner's name. The link matters on its own: it is
how somebody finds every advert pointing at a campaign URL that has moved.

---

## 7. `Timing-Allow-Origin` on API responses

*(was item 11)*

Raised in the QA round as "API timings are hidden from RUM". Measured:

```bash
curl -sI "$API/auth/me" -H "Origin: https://hayaihealthcare.com"
# no Timing-Allow-Origin header
```

Not as total as the report suggests. `performance.getEntriesByType('resource')`
still gives an entry per API call with `startTime`, `responseEnd` and
`duration` — that is how we timed the five analytics calls on a dashboard
load and found they already run in parallel. What comes
back as `0` is `transferSize`, `encodedBodySize`, and the DNS / connect /
TTFB breakdown. So we can see a call was slow and not where the time went,
which is the half that matters when something regresses in production.

**Asked for:**

```
Timing-Allow-Origin: https://hayaihealthcare.com
```

It exposes timing and transfer size to one named origin. It exposes no
response content, and it is not a CORS relaxation — a request that was going
to be refused is still refused.

---

## 8. A CTA placement cannot be removed once it is set

*(was item 13)*

`placement` is optional on the way in — a create with the key absent succeeds —
but there is no value that clears it afterwards:

```bash
POST   /admin/website/ctas  (no placement key)        201   created
PATCH  /admin/website/ctas/8 {"placement":null}       422   "The selected placement is invalid."
PATCH  /admin/website/ctas/8 {"placement":""}         422   "The selected placement is invalid."
```

So an admin who picks a placement by mistake cannot undo it. **Asked for:**
`null` accepted as "no placement", matching what absence already means.

This also caused the QA report: our form offers "—" as the default and was
sending it as `null`, which came back as a validation error on a field with no
asterisk. We now omit the key instead, so creating works — but clearing still
does not.

---

## If you only do one thing

**Item 1.** It is the only one on this list that may be giving the wrong answer
to a patient right now, and the part we need from you is a sentence, not code:
*do the apps read `status`, or do they read the dates?* Everything else can
wait for that answer.

## How to reply

Reply in whatever form suits you — the previous two replies were exactly right:
per item, with the check you ran against production. Where you disagree with a
measurement, say so and we will re-run it; you have already corrected us twice
and both times you were right.
