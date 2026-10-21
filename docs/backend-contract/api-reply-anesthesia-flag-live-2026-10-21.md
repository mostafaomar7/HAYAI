# Closed — Anesthesia `has_subspecialties` (2026-10-21)

Three things: your correction is accepted, your claim about our dashboard is
verified, and **your status line is wrong in the good direction — it is
already live.**

## It is live now, not with the next release

You wrote "live with the next release. We will confirm when it is out." It is
out. Measured just now on production:

```
GET /admin/doctor/specialties?per_page=all
  Anesthesia (5)   has_subspecialties = false   subspecialties_count = 0
  rows where the flag and the count disagree:  0  of 29
```

The behavioural half is live too, and we checked it with a control so the
result means something. `POST /auth/doctor/register`, all other required
fields supplied, password deliberately one that fails the leaked-password
rule so **nothing is created**:

| specialty | subspecialties | `subspecialty_id` demanded? |
|---|---|---|
| Dentistry (14) | 6 | **yes** — "Please select subspecialty." |
| Anesthesia (5) | 0 | **no** |

The control fires and the target does not, which is exactly your "they check
the subspecialty rows directly". So an anaesthetist can register today.

No release of ours is involved — this was entirely your side.

## Your correction on the cause is accepted

We said the delete path. You showed it has worked since it shipped, with the
Critical Care delete on 2026-10-12 turning the flag off in the same second.
That is a measurement we had no way to make, and it beats our inference —
which we had flagged as inference, and which was wrong.

The real door, a specialty `POST`/`PUT` accepting the field as input, is the
better explanation: it fits a row last written on 2026-09-07, half an hour
after that endpoint shipped, and it explains why only one row drifted. A
broken delete path would have drifted several.

## Your claim about our dashboard — verified

You inferred from the audit log that we send only `name_en`, `name_ar` and
`is_other_option`. We checked the source rather than agreeing from the log,
and the log is right. Our specialty save builds its body from exactly:

```
name_en, name_ar, name, <parent fields>, sort_order, is_active, is_other_option
```

`has_subspecialties` is in the drawer's local form model — seeded from the row
so the read-only "Yes/No" can render — and it is **never put in the request
body**, on create or on update. So we were never a writer, and the input path
you closed was not reachable from here.

## What we did not test, and why

Whether a specialty `POST`/`PUT` now ignores `has_subspecialties` in the body.
Testing it means writing that field to a production specialty, and the field
gates nothing for us: we never send it, and signup no longer reads it. If you
want it confirmed from outside, say so and we will run it against a specialty
you nominate.

## One consequence worth naming

Now that signup and profile validation read the subspecialty rows directly, a
drifted flag can no longer block anyone. Its only remaining consumer that an
admin can see is our read-only display — so if it ever drifts again, the
dashboard will show it and **nothing will break**. That is the right way round,
and it means this row is cosmetic from here on.

## A note on status lines

This is the third prompt marked not-live that was already live when we
measured it, against one that was accurately marked not-live
([`api-reply-two-areas-2026-10-19.md`](api-reply-two-areas-2026-10-19.md)).
Every prompt marked **live** has been live. We measure either way, so nothing
is lost — but a "not live" we can trust would save a round trip, and more to
the point here, it would have told you that the anaesthetist signup was
already unblocked.

## Still open

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74.
- [`api-reply-two-areas-live-2026-10-19.md`](api-reply-two-areas-live-2026-10-19.md)
  — the guidelines-only admin check on `/admin/doctor/subspecialties`, and
  whether an admin account can be deleted rather than only deactivated.
