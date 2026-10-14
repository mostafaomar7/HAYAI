# Dashboard reply — the eight open items (2026-10-14)

All eight confirmed working against production this morning, with the probes
below. Four notes, then the answers to your three questions.

**They are live.** Your reply says "fixed in code ... not live yet". By the
time we tested, every one of them was answering on production. Worth knowing
because item 1 changed behaviour under a dashboard that had not caught up — see
item 1.

---

## Confirmed live

| # | probe | result |
|---|---|---|
| 1 | `?status=expired` / `?status=active` | `[6,5,3,2,1]` / `[]` |
| 2 | second category with the same name | 422 `slug_en` "already been taken" |
| 2 | `name_en: "!!!"` | 422 "No address can be made from this name." |
| 3 | `organization.email` / `.phone` / `.whatsapp` | `email` / `phone` / `phone` |
| 4 | `"false"`, `"no"`, `"0"`, `0`, `1` | 422 on all five, nothing written |
| 5 | second `ZZ Dup Probe 1014` | 422, `name_en` **and** `name_ar` |
| 6 | `search=Test` / `Hdhdus` / `youtu.be` / `20%` | advert 5, 5, 5, and 6 |
| 7 | `GET /auth/me` with our `Origin` | `Timing-Allow-Origin: https://hayaihealthcare.com` |
| 8 | create with no placement; then `placement: null` | `"inline"` both times |

Everything created while probing was deleted and the lists re-read.

## 1. The trap you flagged was real, and it was live

Thank you for spelling it out. Our edit form loaded `ad.status` and posted it
straight back, so with your change live, extending the end date of a finished
advert would have re-sent `expired` and pinned it. Every advert on production
reads `expired` today, so every edit was affected.

We took your first option — send `status` only when the admin moves it — plus
one thing your note made obvious:

**The dropdown cannot show a computed `expired` as if the admin chose it.**
`expired` now appears only when the stored value says so *and* `end_date` has
not already passed. When the date is what expired the advert, the control reads
`active` and the date is explained beside it, because that is not a choice the
admin made and not one they can undo there. The option is also relabelled
"Stopped by an admin", which is what it does.

Verified with every write intercepted, and advert 6 read from your API before
and after to prove nothing moved:

```
loads as         control "active" + "already passed its end date"
extend the date  status ABSENT from the request    -> you recompute
stop it by hand  status "expired" in the request   -> the admin's choice kept
```

**One correction to our own side.** While testing this we sent a real edit to
advert 6 by mistake — a probe script that was missing its request
interception. It set `end_date` to 2026-12-31 for about four minutes. We
restored `2026-09-30` by sending the date with no `status`, which put it back
to `expired`; owner, link, start date, publish flag and title were never
touched. Two entries at 07:32 and 07:33 UTC in the audit log are ours, and the
restore at 07:36 is ours too. Incidentally it demonstrated your recompute
exactly as described.

## 3. The two new types are handled

`email` and `phone` are now named in our widget table rather than falling
through to shape guessing. All three settings render with their stored values,
and our own checks agree with yours:

```
organization.email    = "bad-email"          refused
organization.phone    = "not a phone"        refused
organization.whatsapp = "abc"                refused
organization.phone    = "+20 100 000 0000"   accepted
```

## 4. Yes — please make plain `bool` strict too

Our switches already send real JSON booleans to those keys (`case 'bool':
return !!value`), so a strict rule would break nothing on our side and would
close the same hole for anything else posting there. Thank you for the
correction about `FILTER_VALIDATE_BOOLEAN` — "takes whatever is sent" was
wrong, and the distinction matters: the values were being *understood*, just
too generously.

## 5. The QA rows are already gone

We searched every list you named, by name rather than by id:

```
icu/specialty-groups 3 rows   icu/specialties 102   icu/team-roles 29
medical-tourism/specialties 15   .../subspecialties 63
doctor/specialties 29   doctor/subspecialties 60
website/ctas 5   website/categories 0   website/forms 7

QA-TEST-MM leftovers still live: 0
```

CTA 7 and website category 2 are gone as well. **The unique index is
unblocked** — please go ahead, and that closes the two-admins-at-once gap you
mentioned.

## 6. The patient search is yours to decide, not ours

`GET /ads?search=` still matching only the owner is fine by us; the dashboard
does not use it. Whether a patient should be able to search an advert's title
is a product question for whoever owns the apps, and we have no view worth
weighting. We would only say: if it does change, it should change in the apps
and the API together, because a patient typing a campaign name and getting
nothing is the same complaint we filed.

## 8. The label is fixed, and your diagnosis explains the report

"—" was never "no placement" and we had been reading the `null` in the create
response as if it were. The option now reads **"Inline (default)"**. Reading
the row back on create is the better half of that fix: a response that echoes
the request will mislead someone eventually.

## Advertisement 6

Agreed, and it stays with user 7. Noted in our docs so it is not reopened.

---

**Ours, still not deployed.** The dashboard side of all of this — including
the `status` handling above and the advert create fix from 2026-10-13 — is
built and waiting. Nothing here needs anything further from you.
