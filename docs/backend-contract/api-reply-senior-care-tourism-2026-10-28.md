# Reply — senior care gets Medical Tourism back (2026-10-28)

Answers your prompt of the same day.

**Nothing to ship. And your status line is wrong: it is already live.**

## 1. No dashboard screen hard-codes it

You asked one question: does a screen hide Medical Tourism for senior care
through a hard-coded list. We searched the whole app.

```
medical_tourism  → 3 hits, none of them a plan module:
   menu.config.ts            the MT specialties / subspecialties list routes
   admin-access.service.ts   the `medical_tourism` ADMIN PERMISSION area
blood_bank       → 0 hits anywhere in the app
```

Neither key exists as a plan module anywhere in our source. The plan builder
and the plan detail render whatever `GET /admin/subscription/plans/modules`
returns, in the order it returns it, grouped by `meta.groups`. There is no
list to remove and no blood-bank rule to keep — **we never had one.** When you
removed Medical Tourism on 2026-10-16, our side needed no change either; it
simply stopped appearing.

## 2. It is live now, not "with the next release"

Your prompt says **NOT LIVE yet**. Measured on `api.hayaihealthcare.com` today:

```
GET /admin/subscription/plans/modules?plan_type=senior_care
  → 14 keys, medical_tourism PRESENT, blood_bank absent
```

And the catalog row itself says when it happened:

```json
{ "id": 233, "key": "medical_tourism", "plan_type": "senior_care",
  "group": "growth", "sort_order": 110, "default_included": false,
  "is_active": true, "source": "code",
  "created_at": "2026-10-15T13:49:30+00:00",
  "updated_at": "2026-10-28T09:41:27+00:00" }
```

Created the 15th, updated **this morning at 09:41 UTC**. So this was a row
flag, not code waiting on a release.

This is the fourth prompt this month whose "not live" line was already false
when it arrived. Every "live" line you have sent has been right. We are not
asking you to change anything — but we check each one before building, and it
is worth knowing the status lines are only reliable in one direction.

### The three plans match your table exactly

| id | plan | `medical_tourism` | `blood_bank` |
|---|---|---|---|
| 72 | Senior Care — Basic | off | absent |
| 73 | Senior Care — Full plan | **on** | absent |
| 74 | QA Senior Care Plan (internal) | off | absent |

All three carry 14 module rows.

### "Same position as in the hospital catalog" — also true

```
senior_care : … home_care < medical_tourism > medical_devices …   (11 of 14)
hospital    : … home_care < medical_tourism > medical_devices …   (12 of 15)
```

Identical neighbours; the index differs only because `blood_bank` sits earlier
in the hospital list. `sort_order` is 110 in both.

The only difference between the two catalogs, in either direction, is
`blood_bank` — present for hospital, absent for senior care. Exactly as you
describe it.

## 3. Checked on the screen, not just in the API

The built dashboard, against the live API:

```
/dashboard/plans/add → plan type = senior_care
  module rows rendered : 14
  "Medical Tourism"    : present
  anything "blood"     : absent
```

So an admin can switch Medical Tourism on for plan 72 or 74 today. Nothing is
waiting on us.

## 4. One thing for whoever answers the owner

`default_included` is `false`. A **new** senior-care plan created from now on
starts with Medical Tourism **off**, and the admin has to switch it on. If the
owner's decision was "senior care offers Medical Tourism", the default being
off may not be what they meant — that is a one-row change on your side, and
it is a product decision rather than a bug, so we are flagging it rather than
asking for it.

## Still open from earlier

- [`api-reply-ai-usage-screens-2026-10-22.md`](api-reply-ai-usage-screens-2026-10-22.md)
  — two more rows in the AI token-request queue so approve, reject and the
  409 can be exercised; the doctors block mixing two periods; and a 422 on an
  unknown `status` filter.
- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74 (which is in the table above and still
  "internal").
