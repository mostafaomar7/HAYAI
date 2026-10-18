# Reply — Senior Care (2026-10-18)

Built and on `main`. Everything below was measured against
`api.hayaihealthcare.com`; nothing is taken from the document on trust. No
write was made at any point — every write verb was failed at the network
layer while testing.

## 1. "LIVE" was right this time

Checked before building, because the last two prompts were marked not-live and
were partly live. All nine endpoints answer 200, and the behaviour matches:

```
/admin/senior-care                                     200   1 row
/admin/facilities/pending?type=senior_care             200
/admin/hospitals/verifications?...&facility_type=…     200
/admin/subscription/plans?plan_type=senior_care        200
/admin/subscription/plans/modules?plan_type=senior_care 200
/admin/subscription/renewals?user_type=senior_care     200
/admin/users/pending-counts                            200   counts.senior_care present
/lookups/plan-types                                    200   senior_care, sellable
/lookups/user-types                                    200   senior_care present
```

The senior-care row shape is byte-for-byte the hospital row shape — same 15
keys — which is what let us build the screen as a one-line subclass.

## 2. Three corrections to the document

**The module catalog has 13 keys, not 15.** It is not "the same 15 keys as the
hospital catalog":

```
hospital    15   …blood_bank… …medical_tourism…
senior_care 13   (neither)
```

`blood_bank` and `medical_tourism` are absent. That looks deliberate and right
— a senior-care home runs neither — so this is a documentation fix, not a data
one. Plans 72, 73 and 74 all store exactly 13 modules, so nothing is
inconsistent underneath.

**There is a third senior-care plan**, not two:

| id | name | price | months | status | subscribers |
|---|---|---|---|---|---|
| 72 | Senior Care — Basic | 0.00 | 1 | active | 0 |
| 73 | Senior Care — Full plan | 100,000.00 | 1 | active | 0 |
| **74** | **QA Senior Care Plan (internal)** | 0.00 | **0** | inactive | **1** |

Plan 74 is a QA leftover and it is the **ninth** on the list we have been
keeping. It also carries `months: 0`, which is the thing we filed as item 16
on 2026-10-14 — a zero-month plan produces a subscription whose term ends on
the day it starts. It already has one subscriber. So that item is not
theoretical and it is still open.

**Plan 73 at 100,000 EGP** — noted, and nobody here will set it. That is a
pricing decision for whoever owns it, same as plan 52, which is still waiting.

## 3. The hard-coded lists, which is what you asked for

Twelve places needed the new type by hand. Nine were structural and
uninteresting. **Three would have failed silently**, and these are the answer
to your question:

1. **An advert's owner types.** A table pairing `provider_type` with its
   accounts list. A senior-care owner could not have been chosen at all, and
   since you check `provider_type` against the owner's account, an advert for
   a home could not have been created from the dashboard.
2. **The broadcast audience picker's fallback list**, used when
   `/lookups/user-types` cannot be reached.
3. **The renewals user-type filter's fallback list**, same reason.

All three are fixed. We also found and fixed, in the same pass:

4. **The verification queue's copy.** Senior care arrives there as a hospital
   profile with another `facility_type`, and the screen said "No hospitals in
   this state", "Approve this hospital?", "Hospital approved" — in both
   languages. It says *facility* now, and has a second tab row for the type.

**One list we found and deliberately did not change**, which is a question
back to you: `reports.ts` carries a hard-coded `rating_source` list —
`doctor, pharmacy, lab, home_care, medical_device, physical_therapy,
employment_office, insurance`. It has no `hospital` entry today, so we added
no `senior_care` one. There are zero reports on production, so we could not
check empirically. **Can a hospital or a senior-care home be rated and
reported?** If yes, that list is missing two values and the moderation screen
will not filter them.

## 4. Nothing to do, confirmed by measurement

- **Analytics / users by category.** The labels come from your response, not
  from us, so "Senior Care" appears by itself.
- **Sidebar pending badges.** There are none — nothing in the dashboard reads
  `/admin/users/pending-counts` at all today. `items[]` is well-shaped for it
  (`path: "senior-care"` matches our route exactly), so if you want those
  badges, say so and we will build them from `items[]` rather than a list.
- **Website CMS, activity timeline, extra detail tabs** — agreed, nothing.

## 5. The approval hold

Understood and noted: **no senior-care account will be approved from here
until you send the hash.** There is one senior-care account on production,
`HAYAI QA Senior Care` (id 22), and it is already `approved` and `verified` —
so if that public picker is showing homes among hospitals, it may be showing
that one now rather than waiting for a first approval. Worth a look at your
end before the fix ships.

## What we need from you

1. **Can hospitals and senior-care homes be rated?** Section 3, last item.
   It is the only thing we knowingly left unfinished.
2. **The hash for the public-picker fix**, so the approval hold can lift.
3. **Plan 74** — delete it or keep it as a fixture? It is the ninth QA
   leftover, and the first one that has a subscriber and a zero-month term.
4. Still open and unrelated:
   [`api-reply-broadcast-2026-10-15.md`](api-reply-broadcast-2026-10-15.md)
   item 1 — a 422 on an unknown `userTypes[]` value — and
   [`api-items-round5-2026-10-14.md`](api-items-round5-2026-10-14.md) item 18,
   `DELETE /admin/website/menus/{key}`.
