# Reply — AI token requests (2026-10-22)

Built and on `main`. Measured production first, as usual. Three things you did
not mention, one of which changes how much of this brief can actually be used,
and two questions.

## 1. The routes are not live yet

```
GET /admin/ai/token-requests        → 404
GET /admin/ai/token-requests/{id}   → 404
GET /admin/ai/allocations           → 200   (the existing one)
```

No status line in the brief, so this is not a contradiction — just worth
stating, because it means **nothing here has been tested against a real
response**. We built to the shapes in your document and verified the screens
against stubbed responses in a browser. Tell us when it ships and we will run
the real thing.

## 2. There is no "existing AI section" on our side

The brief suggests "a **Token requests** tab inside the existing AI section".
There is no AI section in the dashboard: no screen, no route, no sidebar
entry. We checked the whole app.

That is a bigger gap than this one screen, because the API has more than you
mentioned:

```
GET /admin/ai/allocations   200      GET /admin/ai/usage      200
GET /admin/ai/overview      200
```

Three endpoints with no screen in front of them. We have **not** built those —
this brief asked for token requests, and we are not going to widen it on our
own. But an admin approving a request has nowhere to go to see the grant it
created, the account's usage, or the overview. If you want that section,
it is its own piece of work and we would rather be asked for it than guess
at it.

For now **Token requests is its own sidebar entry**, not a tab, because there
is nothing to be a tab inside of.

## 3. A permission hole, which this screen is what made reachable

`ai` has been in our `AdminArea` list since the access release. **No path ever
mapped to it.** Our route guard reads an unmapped dashboard path as "no area",
which means open to every admin — including the write buttons, because a page
with no area keeps them.

So the moment a URL under `/dashboard/ai/` existed, it would have been
readable and writable by every admin regardless of their `ai` grant. Nobody
could have hit it before, because there was no such URL; this screen is what
would have opened it.

Fixed in the same commit: `/^ai(\/|$)/ → 'ai'`. Nothing needed from you — it
is our bug, and we are reporting it because it is the kind that is invisible
until a feature lands on top of it.

## 4. Tourists cannot produce one of these requests today

```
ai.enabled                  true
ai.patient_monthly_tokens   100000
ai.tourist_monthly_tokens   null
```

Your brief opens with "Patients and tourists have a monthly AI allowance", and
says `monthly_limit: null` means no monthly cap. Tourists are `null` on
production right now, so a tourist never runs out and never presses the
button.

That may be deliberate. It does mean two of your fields arrive null for them:
`monthly_limit` and, by the same rule, `suggested_tokens`. We handle both —
the limit prints "No monthly limit" rather than a number we do not have, and
the amount field is left **empty** rather than pre-filled with `0`, so nobody
approves a grant of nothing by pressing the pre-filled default.

**Is `ai.tourist_monthly_tokens: null` intended, or is it an unset value?**

## 5. What we built

- `/dashboard/ai/token-requests` — the queue, with Pending / Approved /
  Rejected tabs and the `meta.pending_count` badge beside the page total.
  They are different numbers once a filter is on, so both are shown.
- `/dashboard/ai/token-requests/{id}` — a page of its own, not a row the list
  expands, because your bell alert links straight to it and has to land
  somewhere that works with no list behind it.
- Approve takes `tokens` (pre-filled from `suggested_tokens`), an optional
  `ends_at` with today as the minimum, and `admin_note`. The note's hint says
  **"The patient reads this. It is not an internal note."** — that seemed
  worth saying on the screen rather than only in your brief.
- Confirmation before approving, naming the amount and the account, as you
  asked.
- `409` / `AI_TOKEN_REQUEST_ALREADY_REVIEWED` is **not** shown as an error: it
  says somebody decided it first and reloads the row to show which way it
  went.
- `422` puts the message against `tokens` or `ends_at` rather than in a banner.
- The approve and reject buttons are behind `ai.manage`; the screens behind
  `ai.view`.
- A failed list says so. An unreachable queue must never read as an empty one
  — "nobody is waiting" and "we cannot see who is waiting" are opposite
  answers.

### One thing we added that you did not ask for

The detail screen shows the balance **now** next to the balance **as
recorded**, and when the account already has tokens available it says so in a
banner.

A request can sit in the queue across the 1st of the month. When it does, the
renewal has already answered it, and `monthly_used: 100412 / limit: 100000`
from two weeks ago is not a reason to grant anything. The two numbers are
side by side so nobody approves against a stale one.

## 6. How it was verified, given the routes 404

The responses were stubbed in a browser against a real build — the list, the
detail, and a 404 — with every write verb failed at the network layer. Both
languages.

| | |
|---|---|
| list | 3 rows, badges "3 requests" and "2 pending" — `meta.pending_count` is the second one |
| a row with **no `user`** | renders as `#id` instead of throwing |
| patient, `suggested_tokens: 100000` | amount pre-filled 100000, date field's minimum is today |
| **tourist, `suggested_tokens: null`** | amount **empty**, Approve **disabled** — nobody can grant nothing by pressing the default |
| `current_balance.available_tokens > 0` | the "already has tokens" banner appears |
| unknown id | "No request with that number." |
| untranslated keys left on screen | 0, in both languages |

And against a stubbed limited admin:

| pretended access | result |
|---|---|
| `ai.manage` | list opens, Approve present and enabled |
| `ai.view` only | list opens, **Approve absent** |
| no `ai` at all | **`/dashboard/no-access`** |

That last row is the permission hole in section 3, closed and measured.

One thing the stub taught us that is worth passing on: the preflight for these
routes currently fails, because `OPTIONS` on a 404 route returns no CORS
headers. That resolves itself when you ship them — it is not a request.

## Two questions

1. **`reviewed_by`** — your example shows `"reviewed_by": null` and the text
   says the field carries the reviewer. We render either an object
   (`{id, name}`) or a plain string, because the example does not show the
   populated shape. Which is it?
2. **`period`** — `"2026-10"` is a month, and we print it as given rather than
   formatting it, since a localized month name would be guessing at the
   timezone it was computed in. Say if you would rather we formatted it.

## Still open

- [`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md)
  — whether a hospital or senior-care home can be rated, the hash for the
  public picker, and plan 74.
- [`api-reply-two-areas-live-2026-10-19.md`](api-reply-two-areas-live-2026-10-19.md)
  — the guidelines-only admin check on `/admin/doctor/subspecialties`, and
  whether an admin account can be deleted rather than only deactivated.
