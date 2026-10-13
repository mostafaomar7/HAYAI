# What the QA round needs from the API (2026-10-13)

Everything from the dashboard QA bugs that cannot be fixed on the website side.
Each one was measured against the live API, and the commands are here so you
can repeat them.

Nothing here blocks a deploy. Item 1 is the one that has already affected data.

The session-cookie work (BUG-02) is a separate conversation:
[`auth-session-cookie-2026-10-12.md`](auth-session-cookie-2026-10-12.md) and our
reply, [`auth-session-cookie-reply-2026-10-12.md`](auth-session-cookie-reply-2026-10-12.md).

---

## 1. `owner_id` on an advertisement is a **user** id, and nothing says so

**This one has already put wrong data in the database.** From BUG-21, found
while fixing it.

A provider row is keyed by its own table. Doctor row 20 is user 90:

```bash
curl -s "$API/admin/doctors?per_page=3" -H "Authorization: Bearer $T" \
  | jq '.data[] | {id, user_id, name}'
# { "id": 20, "user_id": 90, "name": "Dr Islam Abdelfadel Abdelhakem Ahmed" }
```

The dashboard was sending `20`. Measured on 2026-10-13 with a throwaway advert,
since deleted:

```
POST /admin/advertisements  owner_id=20  provider_type=doctor
    -> stored as provider_type "medical_devices"

POST /admin/advertisements  owner_id=90  provider_type=doctor
    -> stored as provider_type "doctor"
```

So **every advertisement created through the dashboard has been attached to
whichever account happened to hold that number.** Our side is fixed — the picker
sends `user_id` now — but the five adverts already in the database were created
the old way.

**What we are asking for:**

1. **Check the owners of the five existing adverts** (ids 1, 2, 3, 5, 6) against
   who they were meant to belong to. We cannot tell from outside which are
   wrong, because the API does not return the owner at all — see item 2.
2. **Reject an `owner_id` that does not match `provider_type`** with a 422
   instead of storing the mismatch. A validation error would have caught this on
   the first try instead of silently reassigning adverts for weeks.

## 2. `GET /admin/advertisements/{id}` does not return the owner — **done, thank you**

Checked again on 2026-10-13 and both `owner_id` and `owner_name` are now on the
single-advert response *and* on the list. The edit form shows the real owner,
and the list shows who each advert belongs to. Nothing further needed here; the
rest of this section is kept for the record.

Also BUG-21. The payload names the *kind* of owner and never *which* one:

```bash
curl -s "$API/admin/advertisements/6" -H "Authorization: Bearer $T"
# { "id": 6, …, "provider_type": "doctor", … }
#   no owner_id, no user_id, no owner name
```

So the edit form cannot show who owns an advert. Until now the field was
required, which meant an admin had to pick somebody to get past validation —
silently reassigning the advert to whoever they picked. That is what the QA
report was pointing at.

We have made the field optional on edit and we omit it when untouched. Verified
that this is safe: an update carrying only `redirect_link` leaves the owner
alone.

**What we are asking for:** `owner_id` (and ideally `owner_name`) on the
single-advert response. What we have built is a workaround for a field that
should simply be there.

**While you are in there:** `provider_type` is not spelled consistently. Live
rows hold `doctor`, `clinic`, `medical_insurance` and `pharmacies` — singular
for three of them and plural for one. We normalise around it; one spelling
would be better.

## 3. `redirect_link` is not validated server-side

BUG-06. `POST`/`PATCH /admin/advertisements` takes it as free text. All three of
these store fine today:

```
javascript:alert(1)
اهلا يا جماعة
https://hayaihealthcare.com@evil.test
```

The dashboard refuses them now, but that is a form guard, not a boundary: the
same values go straight in with curl, and **the patient and partner apps open
whatever is stored**, with nothing between the string and the browser they hand
it to.

The rule we apply, so yours can match:

| Rejected | Why |
|---|---|
| any scheme that is not `http`/`https` | `javascript:`, `data:`, `intent:`, `file:` have no business in an advert |
| a URL carrying credentials, `https://hayaihealthcare.com@evil.test` | what a person reads is the username; the real host is the last one. The oldest trick there is, and it looks ordinary |
| a host with no dot | a typo, or an internal name |

In Laravel terms: `['required', 'url', 'regex:/^https?:\/\//i']`, plus a check
that the parsed host contains a dot and that there is no `@` before the host.

## 4. The API host has no HSTS

BUG-05 only looked at the website. Measured on 2026-10-12:

```bash
curl -sI https://api.hayaihealthcare.com/api/v1/public/en/site
X-Frame-Options: SAMEORIGIN          ✓
X-Content-Type-Options: nosniff      ✓
Referrer-Policy: strict-origin-…     ✓
Strict-Transport-Security            ← absent
```

The website side is fixed on our next deploy. Yours matters more: the admin
session travels to this host on every request, and without HSTS a first request
made over plain HTTP can be downgraded. One nginx line:

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

`includeSubDomains` is deliberately left off until somebody has confirmed every
subdomain of hayaihealthcare.com serves HTTPS. It is a year-long commitment that
no deploy can undo, so it is a decision to take on purpose rather than inherit.

## 5. Option lists accept duplicate names

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

## 6. Every admin request pays for a CORS preflight, every time

BUG-12, found while measuring the dashboard's cold load.

The dashboard is on `hayaihealthcare.com` and the API on
`api.hayaihealthcare.com`, so every request carries `Authorization` and is
therefore not a simple request: the browser sends an `OPTIONS` first and waits
for the answer before it sends anything. That is normal and unavoidable. What
is not normal is this:

```bash
curl -sI -X OPTIONS "$API/admin/advertisements"   -H "Origin: https://hayaihealthcare.com"   -H "Access-Control-Request-Method: GET"   -H "Access-Control-Request-Headers: authorization"
Access-Control-Max-Age: 0        ← the browser is told not to remember this
```

`0` means the permission may not be cached, so the preflight is repeated for
**every single request** for as long as the admin is signed in. Opening the
dashboard home costs eight of them before a single byte of data moves:

```
/auth/me                               /admin/analytics/overview
/admin/website/me                      /admin/analytics/users-by-category
/admin/notifications/system/unread…    /admin/analytics/revenue-by-plan-type
/admin/analytics/user-growth           /admin/analytics/revenue-over-time
```

On a desk in the office the round trip is 20ms and nobody notices. On a phone
on mobile data it is 150ms or more, and it is spent twice per request for the
whole session.

**What we are asking for:** a lifetime on the preflight.

```php
// config/cors.php
'max_age' => 86400,
```

Chrome caps it at 2 hours whatever you send, so a day is simply "as long as the
browser will allow". Nothing else changes, and nothing can break: the only
thing being cached is the answer to "may this origin call this endpoint", which
does not vary per request.

## 7. Uploaded profile images are stored and served at full size

Also BUG-12. The admin avatar in the dashboard header is a 42-pixel circle. The
file behind it:

```bash
curl -sI "https://api.hayaihealthcare.com/storage/profiles/mw9C5d55…png"
Content-Type: image/png
Last-Modified: Thu, 27 Aug 2026 18:45:58 GMT
ETag: "6a9085e6-beae1"
# 1983 × 793 px, 762 KB
```

762 KB is **three quarters of everything a first visit to the dashboard
downloads** — 1049 KB in total with an empty cache — for a picture displayed at
about one two-thousandth of its area.

1. **Resize on upload.** A stored avatar does not need to be larger than about
   512px on its longest edge. We now shrink the picture in the browser before
   it is sent — a 7.5 MB photo leaves as a 121 KB JPEG — so new uploads are
   small from today. That does not touch anything already stored, and it is a
   convenience, not a boundary: the apps upload to the same endpoint, and
   anything posted with curl still arrives at full size.
2. **Cache `/storage/*`, eventually.** There is no `Cache-Control` header, but
   we measured what that costs before asking: on three loads in a row the
   avatar came from the disk cache every time after the first, with no
   revalidation. `Last-Modified` gives the browser a heuristic of roughly a
   tenth of the file's age, and this one is seven weeks old. The catch is that
   a picture uploaded this morning gets almost none of that, and is
   revalidated on nearly every page for its first few days. Worth setting, not
   urgent:

   ```nginx
   location /storage/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
   ```

## 8. `optional_bool` settings accept any string

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

## 9. Advertisement search only matches the owner's name

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

## Summary

| # | Item | Severity |
|---|---|---|
| 1 | `owner_id` mismatch stored silently — **existing data affected** | needs checking now |
| 2 | advert response omits the owner | **done — shipped, verified 2026-10-13** |
| 3 | `redirect_link` unvalidated server-side | the apps open these links |
| 4 | no HSTS on the API host | one nginx line |
| 5 | option lists accept duplicate names | the signup form shows the same option twice |
| 6 | `Access-Control-Max-Age: 0` — a preflight per request, forever | one config line |
| 7 | avatars stored at 762 KB for a 42px circle | resize on upload; caching is a smaller follow-up |
| 8 | `optional_bool` settings accept any string | the force-update switch takes `"no"` and stores something |
| 9 | advert search covers the owner's name and nothing else | a title cannot be searched for |
