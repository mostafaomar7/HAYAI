# Admin dashboard — wiring done, 4 blockers + 11 confirmations

The 2026-08-18 spec is implemented in the Angular admin dashboard: patient plans
(`plan_type: patient`, `is_default`, `POST /{id}/default`, per-patient exception),
the activity tab, and all seven option-list screens behind one generic component.

Everything below is either **blocking** (the screen is built but cannot behave
correctly), or a **confirmation** we guessed at and want verified before it hits
production. Nothing here asks for a new feature — only for fields, formats, and
answers.

---

## A. Blockers

### A1. `plan_status` is missing from the patients **list** payload

Spec says `GET /admin/patients/{id}` includes `plan_status`. Our dashboard has no
patient *detail* screen — patients are managed from the list — so the per-patient
exception is rendered in the table: an "exception" badge when
`plan_status.plan_id` differs from the default plan, and a **Reset to default**
row action bound to `DELETE /admin/patients/{id}/plan`.

With `plan_status` only on the detail endpoint, every row reads as "default plan"
and the reset action never appears, even for patients who genuinely have an
exception.

**Ask:** include `plan_status` on the rows of `GET /admin/patients`. The trimmed
shape is enough — we only read `plan_id` and `plan_name`:

```json
"plan_status": { "plan_id": 34, "plan_name": "Patient Plan (limited)" }
```

If a per-row join is too expensive, an alternative that also works: a
`plan_id` + `plan_name` pair on the row, or a `has_plan_exception: bool` flag.
Tell us which you prefer and we will read that instead.

---

### A2. `id_type` per provider list is undocumented

The activity endpoints take `id_type=user|organization|facility|doctor`, and the
note says provider lists hand out an organization / facility / doctor id. It does
not say **which list is which**.

We prefer the new `user_id` field when a row carries it, and fall back to this
map, which is a guess:

| Dashboard list | endpoint | our guessed `id_type` |
|---|---|---|
| `/admin/patients` | patients | `user` |
| `/admin/tourists` | tourists | `user` |
| `/admin/doctors` | doctors | `doctor` |
| `/admin/hospitals` | hospitals | `organization` |
| `/admin/clinics` | clinics | `organization` |
| `/admin/pharmacies` | pharmacies | `facility` |
| `/admin/labs` | labs | `facility` |
| `/admin/medical-issuance` | insurance providers | `facility` |
| `/admin/home-care` | home care | `facility` |
| `/admin/physical-therapy` | physical therapy | `facility` |
| `/admin/employment-offices` | employment offices | `facility` |
| `/admin/medical-devices` | medical devices | `facility` |

**Ask (either one closes this):**
1. Correct the table above, **or**
2. Confirm `user_id` is present and non-null on **every** row of all ten provider
   list endpoints — then we drop `id_type` entirely and the guess stops mattering.

(2) is the better answer. A wrong `id_type` is a 422 the admin cannot act on.

---

### A3. `meta.groups[].label` has no Arabic — section headings render English in the Arabic UI

Still open from the plans/feature-gating round, and it now also affects the
**patient** catalog. `GET /admin/subscription/plans/modules` returns:

```json
"meta": { "groups": [ { "key": "services", "label": "Services" } ] }
```

`label` is English regardless of `Accept-Language`. The dashboard renders these
verbatim as section headings, so an Arabic admin editing the patient plan sees
`Account`, `Services`, `Health Records`, `Recruitment` in an otherwise Arabic
screen. We will not hardcode an Arabic translation table on the client — it would
silently drift the moment you add a group.

**Ask:** either make `label` follow `Accept-Language` (preferred — same rule as
`name` on the option lists), or add a `label_ar` sibling:

```json
{ "key": "services", "label": "Services", "label_ar": "الخدمات" }
```

The same applies to the per-row `name` in the catalog and to `group_name`.

---

### A4. Does a partial `PATCH` work on the option lists?

Our **Deactivate** action — on the insurance directory and ICU team roles, and
the "deactivate instead" offer when a delete is refused for being in use — sends
only the one field it changes:

```http
PATCH /api/v1/admin/insurance-providers/4
{ "is_active": false }
```

The spec says `name_en` + `name_ar` are **required** on create/edit (insurance
uses a single `name`). If that validation also runs on a partial `PATCH`, every
deactivate returns 422 and the feature is dead on arrival — including the
"deactivate instead" path the spec itself asks us to offer.

**Ask:** confirm `PATCH` treats the name fields as `sometimes|required` so a
body carrying only `is_active` is accepted. If it does not, tell us and we will
send the full row back instead.

---

## B. Confirmations

Answer inline — one word each is fine.

**B1. `is_active` filter format.** The list table names `is_active` as the
insurance directory's filter but not its format. We send `?is_active=1` and
`?is_active=0`, omitting the param for "both". Accepted? Or do you want
`true`/`false`?

**B2. `search` vs `q`.** We send `search` on all seven lists. Confirmed as the
canonical name, with `q` the alias?

**B3. `per_page=all`.** We use it to fill every parent select (ICU groups, ICU
categories, MT specialties). Supported on all seven endpoints, and is there an
upper bound where it starts refusing?

**B4. Which lists return which counts.** We render an "items" column from the
first roll-up present on a row, in this order:

| List | fields we look for |
|---|---|
| ICU specialty groups | `categories_count`, then `specialties_count` |
| ICU specialty categories | `specialties_count` |
| MT specialties | `subspecialties_count` |
| everything else | no column |

Correct? In particular: do ICU **categories** return `specialties_count`?

**B5. `marketplace_provider_id` on the insurance directory.** We render it as a
raw number input because we do not know what it points at. What is the target,
and is there an endpoint we should turn it into a picker over? Is it nullable and
unvalidated, or does it have to match an existing marketplace provider?

**B6. Activity `type` filter encoding.** We send `?type=lab_order,doctor_request`
(comma-separated in a single param), not `type[]=`. Confirmed?

**B7. Activity `happened_at` may be null.** Where do null-dated rows sort — first,
last, or undefined? We render them with an empty time cell.

**B8. `POST /admin/subscription/plans/{id}/default` scope.** The spec describes it
as exclusive *per plan type*, so we expose it on every plan card, labelled
"Apply to all patients" on patient plans and "Set as default" elsewhere. Is it
actually valid for provider types, or patient-only? If patient-only, we will hide
it everywhere else.

**B9. `subscribers_count` on a non-default patient plan.** On the default plan it
counts every patient. On a *non-default* patient plan, does it count only the
accounts explicitly moved onto it? Our promote-to-default confirmation shows this
number to the admin, so it needs to mean what we say it means.

**B10. Deleting the last row of a filtered page.** All seven lists paginate. After
a delete we refetch and step back a page when the current one comes back empty.
Any endpoint that returns a 404 rather than an empty page for an out-of-range
`page`?

**B11. `code` immutability on ICU team roles.** We render it read-only on edit and
never send it. Confirmed that sending it — even unchanged — is a 422, so we are
right to omit it entirely rather than round-trip it?

---

## C. Still open from the feature-gating round

These predate this spec and are still unanswered. The first one is the important
one.

**C1. `SUBSCRIPTION_GATE_MODE`.** Is it `enforce` in production yet? Until it is,
an admin closing a module in the dashboard changes a database row and nothing
else — the API keeps serving the feature. That is the single worst failure mode
here, because the screen looks like it worked. Please confirm the current value
and tell us when it flips.

**C2. `limit_enforced` on catalog rows.** Six of the twelve limit-carrying keys
came back with the limit not actually enforced. The dashboard renders a limit
input for anything with `supports_limit: true`, which promises a cap we cannot
verify. An explicit `limit_enforced: bool` would let us mark the un-enforced ones
instead of quietly lying.

**C3. Empty `module_name` / `name` on some catalog rows.** A few rows arrive with
neither, so the dashboard falls back to the raw key (`patient_requests`) as the
label. Please fill them in.

**C4. `Profile Management` and `Notifications` render as excluded** on some plans
despite `gateable: false`. If they are never gated they should come back with
`included: true`, so the card does not tell an admin a feature is off when the
server serves it regardless.

---

## D. Not for you — recorded so nobody chases it

Section 3 (dental `files[]`) and section 2 (vaccination schedule Arabic fields) of
the 2026-08-18 note are **mobile app** work. The admin dashboard does not touch
either. The server-rendered `/dashboard/vaccine-schedule-entries` screen stays
where it is; the Angular SPA is not taking it over.
