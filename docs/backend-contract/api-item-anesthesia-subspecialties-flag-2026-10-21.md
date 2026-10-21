# One stale row: `Anesthesia.has_subspecialties` is `true` with zero subspecialties (2026-10-21)

Reported from the dashboard, then measured. Nothing for us to change — the
field is read-only on our side and we never branch on it — but the signup form
does, so this is worth a look.

## The row contradicts itself in the same response

`GET /admin/doctor/specialties`, specialty id 5:

```json
{
  "id": 5,
  "code": "anesthesia",
  "name_en": "Anesthesia",
  "name_ar": "التخدير",
  "has_subspecialties": true,
  "subspecialties_count": 0
}
```

`has_subspecialties` and `subspecialties_count` disagree with each other inside
one object.

## Zero is the truth — checked three ways

```
GET /admin/doctor/subspecialties?per_page=all&specialty_id=5   →  0 rows
GET /doctor/specialties/5/subspecialties   (the public one)    →  "data": []
GET /admin/doctor/subspecialties?per_page=all  →  60 rows, none with parent 5
```

So the flag is wrong, not the count.

## It is the only broken row, which points at the cause

All 29 specialties, both fields compared:

| | |
|---|---|
| flag `true`, count `0` | **1** — Anesthesia |
| flag `false`, count > 0 (the opposite error) | 0 |
| flag `true`, count > 0 (consistent) | 12 |

Twelve rows with subspecialties are all correct, and nothing has the opposite
error. So the half that turns the flag **on** works. What we think happened:
a subspecialty was created under Anesthesia and later deleted, and the
"turns off with the last" half did not fire on that delete. We cannot see
deleted rows, so that part is inference — the measurements above are not.

## Why it matters

The dashboard's own hint for this field says:

> Set automatically. It turns on with the first subspecialty and off with the
> last, and **it decides whether the signup form shows a second dropdown**.

So a doctor who picks **Anesthesia** at signup is shown a subspecialty dropdown
with nothing in it. If that dropdown is required, the signup cannot be
completed at all; if it is optional, it is a dead control. We cannot test the
app, so please check which of the two it is — the first would mean no
anaesthetist can register today.

## What we are asking for

1. **Fix the row** — set `has_subspecialties` to `false` on specialty 5.
2. **Fix the delete path**, so the flag turns off when the last subspecialty
   under a specialty is removed. Without this the same row drifts again the
   next time someone tidies the list.
3. **Worth considering: stop storing the flag.** `subspecialties_count` is
   already in the same payload and is correct, so `has_subspecialties` is
   `subspecialties_count > 0` — derived, it cannot drift, and the signup form
   needs no change because the field keeps its name and meaning.

## Nothing needed from us

The dashboard shows this field read-only on the specialty edit drawer and
never acts on it. We branch on nothing but the subspecialty list itself, which
is correct for this specialty (empty).

## Still open from before

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74.
- [`api-reply-two-areas-live-2026-10-19.md`](api-reply-two-areas-live-2026-10-19.md)
  — confirmation that `/admin/doctor/subspecialties` was tested with a
  guidelines-only admin, and whether an admin account can be deleted rather
  than only deactivated.
