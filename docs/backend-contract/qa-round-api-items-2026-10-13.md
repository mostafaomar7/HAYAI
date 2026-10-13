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

## 2. `GET /admin/advertisements/{id}` does not return the owner

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
ETag: "6a9085e6-beae1"
# 1983 × 793 px, 762 KB — and no Cache-Control header at all
```

762 KB is **three quarters of everything a cold dashboard load downloads**, for
a picture displayed at one two-thousandth of its area. It is fetched again on
every page of the dashboard.

Two things, and they are independent:

1. **Resize on upload.** A stored avatar does not need to be larger than about
   512px on its longest edge. We now shrink the picture in the browser before
   it is sent — a 7.5 MB photo leaves as a 121 KB JPEG — so new uploads are
   small from today. That does not touch anything already stored, and it is a
   convenience, not a boundary: anything posted with curl still arrives at full
   size.
2. **Cache `/storage/*`.** These files are content-addressed — the name changes
   when the picture changes — so they can be cached hard:

   ```nginx
   location /storage/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
   ```

   Today there is no `Cache-Control` at all, so the browser revalidates the
   avatar on every page even when it already has it.

---

## Summary

| # | Item | Severity |
|---|---|---|
| 1 | `owner_id` mismatch stored silently — **existing data affected** | needs checking now |
| 2 | advert response omits the owner | blocks a proper fix, workaround in place |
| 3 | `redirect_link` unvalidated server-side | the apps open these links |
| 4 | no HSTS on the API host | one nginx line |
| 5 | option lists accept duplicate names | the signup form shows the same option twice |
| 6 | `Access-Control-Max-Age: 0` — a preflight per request, forever | one config line |
| 7 | avatars stored at 762 KB and served uncached | one config line + resize on upload |
