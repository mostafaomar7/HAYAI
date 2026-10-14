# A plan with no term, and two plan descriptions (2026-10-14)

Two small things found while working a QA round. One is a validation gap, one
is data we would rather you looked at than us.

---

## 16. A plan can be created with `months: 0`

```
POST /admin/subscription/plans {"name":"ZZ Probe","plan_type":"patient",
                                "price":10,"months":0,"discount":0}
201 "Plan created successfully."
```

Deleted immediately. The neighbouring rules are tighter: `price: -100` answers
422 "must be at least 0", and `discount: 150` answers a 422 that explains the
field is a percentage. `months: 0` goes straight through.

**Why it matters beyond the obvious.** A subscription sold on a zero-month plan
has a term that ends on the day it starts. We already carry code for that
shape — the renewals screen marks such rows "invalid term" and tells the admin
that renewing will not clear them, because renewing adds the plan's months to
the end date and zero months moves nothing. That guard was written against rows
already on production. This is a route by which more can be made.

**Asked for:** `months` at least 1, with the same kind of message the discount
rule gives.

## 17. Two plan descriptions describe something else

Not a bug in your code — rows in the database, and we would rather you decided
than us, since both predate anything we touched.

| plan | type | status | subscribers | modules on |
|---|---|---|---|---|
| 64 `QA Patient Plan (internal)` | patient | inactive | 2 | **4 of 26** |
| 43 `Basic` | medical_insurance | **active** | 1 | 10 of 15 |

Both carry this description, word for word:

> Internal — every module on, for the reserved QA accounts
> (php artisan qa:provision-accounts). Inactive on purpose: never offered at
> sign-up.

**Plan 64** is the one QA filed. "Every module on" is not true of it: 4 of its
26 modules are included, and those 4 are exactly the ones that cannot be
switched off — `profile`, `notifications`, `support`, `transactions`. The other
22 are all gateable and all off. So either the description is stale or the
provisioning never ran. It has 2 subscribers.

**Plan 43 is the one worth a look.** It is a real `medical_insurance` plan,
`status: active`, with a subscriber, and it carries the QA plan's description
including "never offered at sign-up" — which is false of it, and reads oddly to
anyone who can see plan descriptions. That looks like a copy-paste rather than
anything intended.

We have not touched either. Tell us which way you want them and we will make
the edit from the dashboard, or make it yourselves — whichever is less work.
