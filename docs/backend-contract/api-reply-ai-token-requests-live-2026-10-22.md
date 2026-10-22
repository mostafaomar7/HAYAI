# Reply — the AI token-request routes are live, and the queue is empty (2026-10-22)

Follows [`api-reply-ai-token-requests-2026-10-22.md`](api-reply-ai-token-requests-2026-10-22.md),
written this morning. **Correcting ourselves:** that reply said the routes
return 404. They did when we measured. They answer now — some time between
roughly 09:00 and 10:40 today — so that line is out of date, and this is the
re-measurement.

## 1. All five answer, and the envelope matches your brief exactly

```
GET /admin/ai/token-requests                  200
GET /admin/ai/token-requests?status=pending   200
GET /admin/ai/allocations                     200
GET /admin/ai/usage                           200
GET /admin/ai/overview                        200
```

```json
{"success":true,"message":"…","data":[],
 "meta":{"pagination":{"current_page":1,"per_page":15,"total":0,"last_page":1},
         "pending_count":0}}
```

`meta.pending_count` beside `meta.pagination` is the shape we built against.
**Nothing in our screens needed changing.** Thank you for keeping it to the
document.

Then we ran the built dashboard against it — the real endpoint, the real
token, in a browser, with every write verb failed at the network layer so the
run could only read. Both languages:

| | en | ar |
|---|---|---|
| the queue | `200`, empty state — *"No requests in this state."* | `200`, *"لا توجد طلبات في هذه الحالة."* |
| tabs | Pending / Approved / Rejected | قيد المراجعة / مقبولة / مرفوضة |
| badge | `0 requests` | `0 طلب` |
| `/token-requests/1` → real `404` | *"No request with that number."* | *"لا يوجد طلب بهذا الرقم."* |
| untranslated keys on screen | 0 | 0 |

So the list and the not-found path are now measured against you rather than
against a stub. The queue's default filter is `status=pending`, which is the
only call the screen makes on open.

## 2. The queue is empty, so the decision path has still never met real data

`total: 0`, `pending_count: 0`.

Our list screen is now exercised against the real endpoint. The **detail,
approve and reject** screens are not, and cannot be: there is no row to open.
We are not going to invent one on production.

**Is there a way to put one pending request in the queue on purpose?** We can
see three possibilities and none of them is ours to choose:

1. a patient account burns its 100,000 monthly tokens and presses the button
   in the app — the real path, and the slowest;
2. a seeder or an artisan command on your side;
3. a row inserted directly, which we would rather you did than guess at the
   columns.

Whichever you pick, tell us and we will run the full approve → allocation →
balance check against it the same day. Until then, **two of the three screens
in this feature are tested only against stubs** and we would rather say that
plainly than let it read as done.

## 3. `ai.tourist_monthly_tokens` is still unset — not set to null

Measured through `/admin/settings?group=ai`:

```
ai.enabled                  value true    is_default true
ai.patient_monthly_tokens   value 100000  is_default false  updated_by 1  updated_at 2026-10-18 11:02
ai.tourist_monthly_tokens   value null    is_default true   updated_by null  updated_at null
```

The patient allowance was set by hand four days ago. The tourist one has
**never been written** — `updated_by` is null and it is still on its default.
Your own description of the key reads *"Empty: no per-person cap"*, so a
tourist today has no monthly limit, never runs out, and can never produce one
of these requests.

That now looks less like a decision and more like a row nobody got to. **Is it
meant to be unlimited, or was it meant to be 100,000 like patients?** It is one
settings write either way, and our screens already handle both.

## 4. The two shape questions are still open, and section 2 is why

From this morning's reply, unanswered:

1. **`reviewed_by`** — your example shows `null`; we render either
   `{id, name}` or a plain string, because the populated shape was never
   shown. With an empty queue we cannot read it off a real row.
2. **`period`** — we print `"2026-10"` as given rather than formatting it to a
   month name, since that would be guessing at the timezone it was computed
   in. Say if you would rather we formatted it.

## 5. Three endpoints with no screen in front of them

Unchanged from this morning, and worth repeating now that the feature is
live: `/admin/ai/allocations`, `/admin/ai/usage` and `/admin/ai/overview` all
answer and **nothing in our dashboard calls any of them**.

An admin who approves a grant has nowhere to go to see the allocation it
created, the account's usage, or the overview. We have not widened this brief
on our own. If you want that section, ask for it and we will build it to a
document the way we did this one.

## 6. The Windows installer link now follows your version gate

You asked us to link to the page and never to the installer. We were then
asked, by our side, for the opposite: clicking the button must download
`HayaiPartnerSetup-1.0.1.12.exe`. That is the decision, so that is what ships.

We did not hard-code it and walk away. The href starts at the build we knew
about and is **replaced by `download_url` from `/app/version-gate`** as soon
as that answers — only when the URL starts with
`https://get.hayaihealthcare.com/`, so the response can never send a partner
somewhere else.

Measured just now:

```
GET /app/version-gate   X-Client-Platform: windows   X-Client-App: com.hayai.partner
→ version_name 1.0.1   latest_build 12
  download_url https://get.hayaihealthcare.com/HayaiPartnerSetup-1.0.1.12.exe
HEAD that URL → 200  application/octet-stream
```

**So one thing becomes a requirement rather than a courtesy:** update the gate
in the same release that publishes a new installer. If a build ships and the
gate still names the old file, our button hands partners the old build — and
if the old file has been removed, a 404. Please also keep the previous
installer reachable until the gate has moved.

This is the whole reason the version is read rather than typed: the filename
went 1.0.0.11 → 1.0.1.12 inside one day.

### Where the button actually is

For the record, because it was asked twice: the live button is the CMS CTA
`get-app-partners-windows`, attached and **published** on three pages in both
languages — verified in the rendered HTML, not in the admin:

| page | ar | en |
|---|---|---|
| How HAYAI works (5) | `/ar/كيف-تعمل-حياة` | `/en/how-it-works` |
| Insurance coverage (3) | `/ar/تغطية-التأمين` | `/en/insurance-coverage` |
| About (7) | `/ar/عن-حياة` | `/en/about` |

The home page (1) does not carry it. Nothing needed from you here.

## Still open from earlier

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74.
- [`api-reply-two-areas-live-2026-10-19.md`](api-reply-two-areas-live-2026-10-19.md)
  — the guidelines-only admin check on `/admin/doctor/subspecialties`, and
  whether an admin account can be deleted rather than only deactivated. The
  second one is now concrete: `codeplus90@gmail.com` (admin 123) is a test
  account we created and cannot remove.
