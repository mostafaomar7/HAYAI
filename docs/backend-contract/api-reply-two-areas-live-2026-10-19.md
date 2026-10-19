# `clinical_guidelines` and `external_devices` are live — one thing to hold (2026-10-19)

Measured `bf7c1b3` on production as super-admin. **Both of your claims hold.**
Then one consequence of the ordering that needs a decision before anyone
assigns the new role.

## Confirmed: the areas are live

```
GET /admin/access/me   →  25 areas   (was 23 this morning)
   clinical_guidelines    {view: true, manage: true}
   external_devices       {view: true, manage: true}
```

`GET /admin/access/permissions` carries both keys in the catalogue too, so the
Roles matrix renders them without us shipping a list.

## Confirmed: every parent grant was copied, at the same level

All twelve roles, from `GET /admin/access/roles`:

| role | doctors | clinical_guidelines | medical_devices | external_devices | admins |
|---|---|---|---|---|---|
| analyst | – | – | – | – | 1 |
| **clinical-guidelines-editor** | – | **manage** | – | – | 0 |
| content-editor | – | – | – | – | 0 |
| customer-service | view | view | view | view | 0 |
| providers-manager | manage | manage | manage | manage | 0 |
| publisher | – | – | – | – | 0 |
| qa-test-mm-role | – | – | – | – | 0 |
| read-only | view | view | view | view | 0 |
| sales-manager | – | – | – | – | 0 |
| seo-manager | – | – | – | – | 0 |
| subscriptions-manager | – | – | – | – | 0 |
| super-admin | manage | manage | manage | manage | 1 |

No role holds a parent without the new area, and `view` was copied as `view`
rather than widened to `manage`. Our fallback is now unreachable, exactly as
you say.

**We are keeping it anyway**, and not because it is needed: it costs one
object lookup, it is the thing that saves us if `bf7c1b3` is ever rolled back,
and it is the mechanism the next split will reuse. It is commented as dead.

## Hold this: `clinical-guidelines-editor` cannot be used yet

This is the mirror of the window we described, and it is on our side of it.

The role is `is_system: true` with exactly one permission:

```
clinical-guidelines-editor   permissions: ["clinical_guidelines.manage"]
                             website_permissions: []      admins: 0
```

The dashboard **currently deployed** is `188ff32`, which predates the split. In
it, `lists/clinical-guidelines` maps to `doctors`:

```
188ff32:  [/^(doctor|lists\/clinical-guidelines|lists\/doctor-)/, 'doctors']
HEAD:     [/^lists\/clinical-guidelines/, 'clinical_guidelines']
          [/^(doctor|lists\/doctor-)/,     'doctors']
```

So an admin holding only that role, on today's site, has **no area that
matches any screen at all**: the Clinical guidelines entry is hidden, the
direct link lands on `/no-access`, and because the role grants nothing else
the sidebar is empty. They would be able to sign in and do nothing.

Nobody is affected — `admins: 0`. But it needs one of these, in this order:

1. **Do not assign `clinical-guidelines-editor` until the dashboard release
   below is deployed.** Then it works, and `manage` on it shows the write
   buttons; we tested both.
2. Release `4121bd1` is built and waiting with the deploy guide
   ([`website-release-4121bd1.md`](website-release-4121bd1.md)). It is the
   release that makes the role usable.

Worth noting for the general case: a role whose *only* permission is a new
area is the one shape your "nobody loses access" copy cannot protect, because
there is no old grant to inherit. It is safe when the dashboard ships first
and dead when it ships second — the opposite way round from everything else in
this split.

## The one claim we could not verify, and why we are not going to

You fixed the shared read:

> `GET /admin/doctor/specialties*` and `/admin/doctor/subspecialties*` now open
> with `doctors.view` **or** `clinical_guidelines.view`.

We can confirm from our source that this is the only extra call the guideline
screens make, and that they make it read-only. We **cannot** confirm the
server side of it as a super-admin, and testing it properly needs an admin who
holds `clinical_guidelines` without `doctors`.

Creating one is a one-way door: `/admin/access/admins` has create, update,
roles, deactivate, reactivate, reset-password and resend-invitation, but **no
delete**. A test admin is permanent, and we are already asking you to clean up
nine QA leftovers — we are not going to add a tenth to check something you
have already fixed.

So either:

- **confirm you tested it** with a guidelines-only admin, and we will treat it
  as closed; or
- if a `DELETE /admin/access/admins/{id}` exists or could, tell us and we will
  verify it ourselves, here and for every future area.

If it turns out not to be open, the symptom is quiet: both screens swallow a
403 on that call, so the category dropdown is simply empty and the admin gets
no message. That is why we would rather one of us actually ran it.

## Unrelated, while we were in there

`qa-test-mm-role` is still present — 0 admins, `is_system: false`, holding
`cms.view` and `media.view`. It is ours, from QA, and roles *can* be deleted.
Delete it when convenient, or say so and we will.

## Still open

[`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md) —
whether a hospital or senior-care home can be rated, the hash for the public
picker, and plan 74.
