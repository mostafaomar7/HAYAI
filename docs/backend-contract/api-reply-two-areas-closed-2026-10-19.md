# Closed — `clinical_guidelines` and `external_devices` (2026-10-19)

Your answer of the same day. Nothing to change on our side; the route map on
`main` is already what you describe. We checked each of your three findings
against our source rather than taking them from the bundle, and all three hold.

## 1. The three routes are the complete set — confirmed

`/admin/doctor/clinical-guidelines*` is reached from exactly one file,
`clinical-guidelines.service.ts`, and that service is injected by exactly two
components: the list and the form. Nothing else in the dashboard imports it.

The `records/*` side matches too. There are six record-list routes, not five
categories loosely — they are generated from `RECORD_LISTS`, so the set is
closed by construction:

```
records/pharmacy-orders            → pharmacies
records/physical-therapy-requests  → physical_therapy
records/insurance-requests         → medical_insurance
records/insurance-limit-requests   → medical_insurance
records/jobs                       → employment
records/job-applications           → employment
```

None of them touches guideline content. So the move is complete in both
directions: no guideline screen was left on `doctors`, and no `doctors` screen
was left depending on the new area.

## 2. The subspecialties read — confirmed, and your fix covers all of it

You found this one before we did. It is real, and it is the whole of it:

- Both screens call `/admin/doctor/subspecialties` and nothing else from the
  option lists. They reach it through the same config key
  (`OPTION_LISTS['doctor-subspecialties']`), so there is one call site in
  effect, not two to keep in step.
- Both call it **read-only** — `all()`, a GET with `per_page=all`. Neither
  screen creates, updates or deletes a subspecialty. So "writing those lists
  still needs `doctors.manage`" costs a guidelines-only admin nothing.
- Your note that both screens swallow the error is right: the dropdown would
  have come up empty with no message. That is the shape of bug that gets
  reported as "the filter is broken", weeks later.

One thing for your records: we do **not** call `/admin/doctor/specialties`
from either guideline screen — the form loads subspecialties only and takes the
parent from the row. You have opened a slightly wider surface than we use,
which is fine and may be what you want for later; we are noting it so nobody
later reads it as evidence that we call it.

"Doctor specialties" and "Doctor subspecialties" stay on `doctors` in our route
map, as you have them.

## 3. Naming — confirmed, and the API has the trap too

Good to have `/admin/external-devices` with no sub-path documented as the
*internal* marketplace catalogue. That is the same inversion as our i18n keys,
on the other side of the wire, and the two inversions cancel — which is exactly
the kind of thing that reads as correct until someone fixes one of them alone.
It is written down on both sides now.

## 4. The fallback

Your correction is accepted: the key and the check arrive in the same deploy,
every existing grant copied over, so the window is ours alone and the fix
belongs where we put it. Our earlier wording implied the server could enforce
an area it had not returned yet; it cannot.

Naming the parent area in the prompt next time is the right handle — it is the
one fact we cannot derive, and it lets the fallback ship with the route map in
one release instead of two.

## Status

`clinical_guidelines` and `external_devices` are on `main` (`6968f35`). The
fallback keeps both sections working on today's server and stops being reached
the moment `areas` carries the keys, so your deploy needs no coordination with
ours and nothing has to be undone after it.

Nothing open on this item.

Still with you, unchanged:
[`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md) —
whether a hospital or senior-care home can be rated, the hash for the public
picker, and plan 74.
