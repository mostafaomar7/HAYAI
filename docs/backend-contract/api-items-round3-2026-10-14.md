# Two more lists, and six QA rows your sweep missed (2026-10-14)

Follow-up to item 5. Short — one new ask and one housekeeping note.

---

## 15. Two modules your duplicate-name fix did not reach

A QA round filed duplicates across nine list modules. We tested each one
against production today, posting the same name twice:

| module | second POST |
|---|---|
| ICU specialty groups | 422 |
| ICU specialty categories | 422 |
| ICU specialties | 422 |
| ICU team roles | 422 |
| medical-tourism specialties | 422 |
| medical-tourism subspecialties | 422 |
| insurance directory | 422 |
| **device categories** (`/admin/external-devices/categories`) | **201** |
| **shipping companies** (`/admin/external-devices/shipping-companies`) | **201** |

Seven of the nine are closed by your item 5 — thank you. The two that are not
are both in the external-devices module, which your table did not list.

```
POST /admin/external-devices/categories {"name_en":"ZZ Dup 1014d","name_ar":"..."}  (twice)
  -> id 8, slug "zz-dup-1014d"
  -> id 9, slug "zz-dup-1014d-1"      accepted, same name, slug disambiguated

POST /admin/external-devices/shipping-companies {"name":"ZZ Dup 1014c"}   (twice)
  -> id 5, then id 6                  accepted, nothing to tell them apart
```

Both probe pairs were deleted.

**Asked for:** the same rule you applied to the other seven — case-insensitive,
trimmed, per language for categories (`name_en` and `name_ar` separately), and
a 422 rather than a slug suffix. A category's slug being made unique keeps the
database happy and leaves two rows reading identically in the picker, which is
the same shape as the `_2` suffix you removed from the option lists.

Our side now checks both screens against the list before saving, as we did for
the option lists. Same caveat as before: a form guard, not a boundary.

## Housekeeping — six QA rows still live, in modules you did not check

Your item 5 note said the only duplicates left were the QA rows, and those are
indeed gone from the lists you named. Six more are still on production, in
three places outside that sweep:

| module | ids | names |
|---|---|---|
| device categories | 6, 7 | `QA-TEST-MM Category UPDATED`, `QA-TEST-MM Category` |
| shipping companies | 3, 4 | `QA-TEST-MM Shipping UPDATED`, `QA-TEST-MM Shipping` |
| website redirects | 1, 2 | `/en/qa-test-mm-old` ↔ `/en/qa-test-mm-new`, both inactive |
| subscription plans | 67 | `QA-TEST-MM Plan`, inactive, 0 subscribers |

The first four appear in the pickers on a group order. Plan 67 was found later, on the same sweep widened to the plans list; it is inactive with no subscribers, so it is only clutter. **Please delete them, or
tell us to** — same answer as last time is fine.

The two redirects are harmless and worth keeping as a test case if you like:
they are the loop pair from the QA report, and they can never both be switched
on (see below).

## Not an item — the redirect loop check is solid

A QA round reported that a two-step loop could be saved. It cannot, any more.
We probed every way in we could think of:

```
A -> A                                422  "A redirect cannot point to itself."
A -> B then B -> A                    422  "This redirect would create a loop."
edit an existing B -> C into B -> A    422  same
A -> B, B -> C, then C -> A            422  same, so a longer ring is caught too
A -> B and B -> A both created while inactive   both 201
   enable the first                   200
   enable the second                  422  "This redirect would create a loop."
```

That last pair is the interesting one: staging a loop while disabled is
allowed, which is right — a disabled redirect does nothing — and the check
fires at the moment it would become real. Nothing to do here; recording it
because the report is still open on the QA sheet and this closes it.

All probe redirects were deleted; only the two QA rows above remain.
