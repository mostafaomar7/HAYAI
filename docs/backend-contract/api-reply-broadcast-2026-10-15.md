# Reply — broadcast targeting, the recipient preview, and `link` (2026-10-15)

Both prompts are built and on `main`. Everything below was measured against
`api.hayaihealthcare.com`, not read off the document. No broadcast was sent at
any point: `POST /broadcast` was blocked at the network layer throughout, and
only `/broadcast/preview`, which sends nothing, was allowed through.

Four things need you. They are at the end, shortest first.

---

## 1. "NEXT RELEASE" was half right, and the half that was wrong matters

The **targeting and the preview are already live.** I ran every rule in the
document through `/broadcast/preview` before writing any code:

| From the document | Measured |
|---|---|
| `genders` narrows patient/tourist only | `patient+pharmacies+female` → 14 = 7 patients + **7 pharmacies, untouched** |
| specialty ∪ subspecialty over doctors | internal medicine + cardiology → 5, not the 3-way intersection |
| `all` ignores `userTypes`, sub-filters still apply | 91 either way; `all+female` → 78 |
| `user_type` with `[]` reaches nobody | `total: 0` |
| snake_case accepted | `specialty_ids` → same count as `specialtyIds` |
| unknown gender / specialty id | 422 under the exact key you documented |

**`link` is the half that is genuinely not live**, and I checked it two ways
rather than trusting either one:

- It is absent from every row of `GET /broadcast/history` — not `null`, absent.
- A broadcast whose `link` is `not-a-url`, and one whose link is 270
  characters, are both **accepted**; the request fails only on the other field
  I deliberately made invalid. So there is no rule for `link` yet. (That probe
  never dispatched anything — validation rejected it first, by design.)

I mention the distinction because it is the second prompt in a row marked not
live that was partly live. If it helps, the check I use is one request:
`POST /broadcast/preview` returning 200 means the targeting is deployed.

## 2. Four broadcasts on production reached nobody, and it was our fault

This is the one you most need to know.

Our audience list was written from this dashboard's own names rather than
yours. Three of its thirteen options sent a user type you do not have:

```
pharmacy          0 accounts        pharmacies         7
lab               0                 labs_radiology     5
medical_issuance  0                 medical_insurance  4
```

It is not theoretical. `GET /broadcast/history` shows it already happened:

| broadcast | target | queued |
|---|---|---|
| 2, 10, 11 | `pharmacy` | **0** |
| 15 | `lab` | **0** |
| 14 `clinic`, 13 `hospital`, 12 `tourist`, 9 `patient`, 3 `medical_devices` | correct spellings | 7, 9, 7, 14, 1 |

Every correctly-spelled broadcast delivered. Every misspelled one silently did
not. Fixed on our side — the list comes from `/lookups/user-types` now.

**The request:** make an unknown value in `userTypes[]` a 422, the same as you
already do for an unknown gender or specialty id. Silently reaching nobody is
the only failure here an admin cannot see: the screen said "sent", the count
said 0, and 0 looks like a quiet day rather than a bug. You already reject the
other two unknown-value cases; this is the third and it is the expensive one.

## 3. Two lookups are English-only

Both ignore `Accept-Language`:

- `GET /lookups/user-types` — `label` is always English.
- `GET /lookups/doctor-specialties` — `{id, name}`, English, no Arabic field
  at all.

Neither blocks us. We render our own names for account types, and for
specialties we use `GET /doctor/specialties` exactly as your document said —
it carries `name_ar` and `name_en`, and it is the only one that does. **You
were right about that endpoint and I nearly took a shortcut past it**; the
Arabic screen is what caught me.

Worth knowing in case anything else consumes those labels and shows them to a
user. If `/lookups/doctor-specialties` is meant to be localized, it is not.

## 4. What we built, so you know what to expect in QA

- Account types as checkboxes, from your lookup.
- Gender under patients and tourists; specialty and subspecialty under
  doctors, both loaded from `/doctor/specialties`.
- The reach count from `/broadcast/preview`, debounced, with the per-type
  breakdown. Reaching nobody is styled as a warning rather than a success —
  it is not an error, but it must not look like one either.
- Title, body and link limits enforced before send, with live counters.
- `link` omitted from the request when empty rather than sent as `""`.
- The history row now names the audience in the admin's language and says
  when it was narrowed by gender or specialty. Rows that targeted
  `pharmacy` or `lab` still print those raw values on purpose: that broadcast
  did not reach pharmacies, and writing "Pharmacies" there would claim it did.

---

## What we need from you

1. **A 422 on an unknown `userTypes[]` value.** Item 2. The only one of these
   that has already cost real deliveries.
2. **The release hash when `link` goes live**, as you offered. Our field is
   built and validated client-side; nothing breaks before then, but until the
   server validates it too, a bad link is caught in only one place.
3. **A note on whether `/lookups/user-types` and `/lookups/doctor-specialties`
   are supposed to be localized.** Item 3. Not blocking.
4. Still open from before, unchanged:
   [`api-items-round5-2026-10-14.md`](api-items-round5-2026-10-14.md) item 18 —
   `DELETE /admin/website/menus/{key}` answers 405, and `qa-test-mm` is stuck
   on production because of it.
