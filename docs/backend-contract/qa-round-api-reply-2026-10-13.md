# Dashboard reply — both of your 2026-10-13 answers

Covering "Backend reply — dashboard QA, the API items" and "Backend reply — the
two dashboard slowdowns". Everything below was measured against production
today, after your release.

**Read item 0 first.** It is the only thing that is on fire, it was ours, and
it is already fixed on our side.

---

## 0. Creating an advertisement was broken from the moment item 1 shipped

> "Your create form already sends it, so this should be a no-op for you."

It did not. The dashboard has never sent `provider_type` on create — not a
wrong value, no value at all. The owner picker was keyed by our admin route
names (`doctors`, `medical-issuance`) and that vocabulary never left the form.

So from the moment `provider_type` became required, every advertisement created
from the dashboard was refused. Reproduced against production with exactly what
the form was sending:

```bash
curl -X POST "$API/admin/advertisements" -H "Authorization: Bearer $T" \
  -F owner_id=90 -F redirect_link=https://hayaihealthcare.com/en \
  -F is_published=0 -F status=active -F image=@tiny.png

422 {"errors":{"provider_type":["Provider type is required, so the owner can be checked against it."]}}
```

**Fixed.** The form now holds one table pairing your account type with the
admin route we list owners from, read from `GET /lookups/user-types` rather
than guessed — the two that are not derivable from each other being
`labs` → `labs_radiology` and `medical-issuance` → `medical_insurance`.
`owner_id` and `provider_type` are sent together or not at all, which keeps
"omit both to leave the owner alone" working on edit.

Verified end to end, with the probe deleted afterwards:

```
POST owner_id=90 provider_type=doctor   -> 201, advert 11,
                                           owner_name "Dr Islam Abdelfadel Abdelhakem Ahmed"
POST owner_id=20 provider_type=doctor   -> 422 "Account #20 is a Medical Devices
                                           account, not a Doctor."
DELETE /admin/advertisements/11         -> gone; live ids back to 6, 5, 3, 2, 1
```

No blame in this — but it is worth both of us noticing that a required field
was added on the assumption that we already sent it, and nothing caught it for
either side until somebody tried. **Your error message is what made it a
ten-minute fix**: it named the field and said why it exists.

## 1. The five existing adverts

Thank you for doing the archaeology. Four proved correct is better news than we
expected.

**Advert 6 we cannot answer either.** It was created on 2026-09-26, before your
audit log and before any of our logging, and nobody on this side chose its
owner. We have asked whoever was running the dashboard that week; if no one
remembers, our suggestion is to leave it where it is rather than guess, since
"kareem alaa eldeen" is a real account and moving it to the wrong one is the
same mistake again in the other direction.

**The edit finding is a relief.** We had assumed the worst — that an admin
forced to pick an owner to get past our old required field had been reassigning
adverts for weeks. If edit never read `owner_id`, that never happened. We have
corrected our own write-up to say so.

## 2. `owner_id`, `owner_name`, `provider_type_label` — done

Confirmed on the list and on the single advert. Our workaround is gone:

- the edit form prefills the real owner instead of leaving the field blank with
  a notice;
- the owner's name and the translated `provider_type_label` are now on each
  card in the list, which the QA round had also asked for — the cards used to
  show nothing but the raw redirect URL;
- the normaliser that stripped separators and trailing `s` to guess at your
  spelling is deleted. **Point taken on `pharmacies`**: it is the account-type
  token, not an inconsistency, and we were "tidying" a value the apps filter
  on. We display the label and leave the token alone.

## 3. `redirect_link` — your correction accepted, and the three new rules are in

**On `javascript:alert(1)` and `اهلا يا جماعة`:** you checked the code; we
did not re-check before writing it down. We have no way to re-measure the old
behaviour now that the rule has changed, so we are taking your reading over
ours and have corrected the item. What we should have written is that the
third example stored — which it did, and which is the one that mattered.

The three rules you added are now in our form guard as well, so the two sides
refuse the same things:

| added | why ours needed care |
|---|---|
| a backslash anywhere | checked on the raw string: `URL` rewrites `\` to `/` before we could see it |
| an IP address as host | IPv4 by shape; IPv6 is already refused as a dotless host |
| whitespace, controls, invisible marks | zero-width and the bidi overrides, which is what makes a link read backwards |

Tested against your table — all thirteen refused, and Arabic domains and paths
still accepted:

```
javascript:alert(1)                       scheme
//evil.test                               malformed
https://hayaihealthcare.com@evil.test     credentials
http://localhost/admin                    host
http://127.0.0.1/                         ip
https://evil.test\@hayaihealthcare.com    backslash
https://x.com/a b                         whitespace
https://x.com/<RLO>ab                     whitespace
اهلا يا جماعة                              whitespace
https://مثال.مصر/عرض                       accepted
```

**Withholding unsafe stored links from the apps is the right call** and better
than what we asked for. Showing the stored value in the admin payload so it can
be found and fixed is exactly right.

## 4. HSTS — confirmed

```
Strict-Transport-Security: max-age=31536000
```

---

# On the performance answers

**Measured after your release, before ours.** Production still serves our old
bundle, so this isolates what your three items did on their own. Two headless
loads of `/dashboard`, bytes counted off the wire:

| | before (2026-10-13, pre-release) | first load now | second load now |
|---|---|---|---|
| total over the wire | ~1,044 KB | **395 KB** | **12.3 KB** |
| the avatar | 762 KB — 73% of the load | 8.7 KB — 2.2% | 0 bytes, from cache |
| `OPTIONS` preflights | 9 | 9 | **0** |
| first contentful paint | — | 1,412 ms | 548 ms |

**62% off the first load and effectively all of the second.** The avatar went
from the single largest thing on the page to the sixth. `Access-Control-Max-Age`
does nothing on a first visit, as expected — all nine preflights are still
there — and removes all nine on every visit after it. Your `expires 1y` is
doing its job: the avatar is served from disk with no revalidation.

Three confirmations of your own checks, run independently:

```
OPTIONS /auth/me        Access-Control-Max-Age: 86400
GET /storage/profiles/Xasea…jpg
                        Content-Length: 8444
                        Cache-Control: max-age=31536000
                        X-Frame-Options / X-Content-Type-Options /
                        Referrer-Policy / Strict-Transport-Security  all present
GET /auth/me            profile_image -> the new filename
```

The four security headers survived the switch to `expires`, which was the whole
point of your correction.

**On the stale-URL warning.** We checked: nothing on our side persists the user
record, only the token. `profile_image` is read from `/auth/me` on every load
and the avatar is a computed value off it, so a reload is enough — there is no
cached old URL anywhere to go 404. Only a tab left open across 12:16 UTC was
affected, exactly as you said.


## Preflight max-age, and resizing on upload

Both good as described. The resize going on all four endpoints is more than we
asked for and is the part that actually closes it — ours was only ever a
convenience on one form. **Stripping EXIF is a better catch than the resize**:
we had not thought about the GPS position in a phone photo on a public URL.

1983×793 PNG at 762 KB → 512×205 JPEG at 8.2 KB is a better result than our
browser-side shrink gets, so we will leave both in place as you suggest.

## `Cache-Control` on `/storage` — our snippet was wrong, thank you

**The `add_header` point is the important one.** We wrote a `location` block
with `add_header` in it without thinking about inheritance, and you are right
that it would have silently dropped `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy` and the HSTS header we had just asked you
to add — from exactly the files most worth getting right. `expires 1y` instead,
and losing `immutable`, costs nothing we care about.

**"Content-addressed" was our word and it was wrong.** We inferred it from one
filename that looked like a hash. You went and looked. And the thing that
inference would have cost — `profiles/user_<id>.jpg` overwritten in place, a
patient stuck looking at their old photo for a year — is precisely the failure
our wording would have caused. Sequencing the header behind the rename is the
right order.

**Scoping it to `/storage/profiles/` only** is also right, and we would not have
known that the media library re-encodes in place.

---

## Still open from our side

Items we have raised that these two replies do not cover. Full detail in
`qa-round-api-items-2026-10-13.md`.

| # | Item | What we need |
|---|---|---|
| 5 | option lists accept duplicate names | a unique index per list, and a 422 instead of a silent `_2` |
| 8 | `optional_bool` settings accept any string | `"false"`, `"no"` and `"0"` were each accepted and stored on `app_version.patient.force_update`. Our side is a three-state select now and sends a real boolean |
| 9 | advert `search` matches only the owner's name | the title, description and redirect link too — `search=Test` finds nothing although advert 5 is called Test |
| 10 | advert `status` is never expired | **the one we would most like answered:** all five adverts ended between August and 30 September and all five still report `active`. Do the apps decide from `status` or from the dates? If from `status`, five finished advertisements are still being served |

Item 10 is the only one of these that may be affecting people right now.

## 11. `Timing-Allow-Origin` on API responses

A QA round raised that real-user monitoring cannot see API timings. Checked:

```
curl -sI $API/auth/me -H "Origin: https://hayaihealthcare.com"   # no Timing-Allow-Origin
```

Without it, `performance.getEntriesByType('resource')` still gives us an entry
for every API call, with `startTime`, `responseEnd` and `duration` — so the
claim that timings are completely hidden is not right. What is hidden is
`transferSize`, `encodedBodySize` and the connect/TTFB breakdown, all of which
read as `0`. That is enough to see that a call was slow and not enough to see
*why*, which is exactly the half that matters when something regresses.

**What we are asking for:** `Timing-Allow-Origin: https://hayaihealthcare.com`
on API responses. It exposes timing and size, not content, to one named origin.

## 12. One aggregated analytics call — we looked, and we are not asking for it

Raised with us as "the dashboard fires 7 analytics endpoints per view". The
count is five, and we measured what they actually cost on a live load:

```
 999 -> 1181 ( 182ms)  /admin/analytics/overview
 999 -> 1199 ( 200ms)  /admin/analytics/users-by-category
1000 -> 1199 ( 199ms)  /admin/analytics/revenue-by-plan-type
1000 -> 1199 ( 199ms)  /admin/analytics/user-growth
1001 -> 1342 ( 341ms)  /admin/analytics/revenue-over-time

serial would cost 1,121 ms      actual wall clock 343 ms
```

They already go out together, so the page waits for the slowest one, not for
the sum. A single aggregated endpoint would save around 140 ms at best, and
would cost you a new endpoint whose response shape five screens then depend on.
**Not worth it** — we would rather you spent the time on item 10.

The thing actually on the critical path in that trace is ours: nothing starts
until `/auth/me` returns at ~973 ms, because it is fetched twice. That is item
6, and the fix is written.

**One of ours, for completeness.** The cold load above still shows `/auth/me`
fetched twice. That is our duplicate, the one you answered as item 6, and the
fix is written but not yet deployed — the measurement was taken against the
bundle currently on production. Nothing is needed from you.

