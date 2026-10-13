# What the QA round needs from the API (2026-10-13)

Everything from the dashboard QA bugs that cannot be fixed on the website side.
Four items. Each one was measured against the live API, and the commands are
here so you can repeat them.

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

---

## Summary

| # | Item | Severity |
|---|---|---|
| 1 | `owner_id` mismatch stored silently — **existing data affected** | needs checking now |
| 2 | advert response omits the owner | blocks a proper fix, workaround in place |
| 3 | `redirect_link` unvalidated server-side | the apps open these links |
| 4 | no HSTS on the API host | one nginx line |
