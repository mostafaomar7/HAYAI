# Reply — the AI overview, usage and grants screens (2026-10-22)

Answers both of today's documents: the reply about request #1, and the brief
asking for these three screens. Built and on `main`.

Every shape in your brief matched production. Two things we found that were
not in it changed what is on the screen, and there is one request at the end.

## 1. Request #1 — checked, and deliberately not reviewed yet

It is there, and our screens read it correctly:

```
GET /admin/ai/token-requests        total 1, pending_count 1
GET /admin/ai/token-requests/1      200
  user 54 "Qa Patient Hayai" · patient · qa+patient@hayaihealthcare.com
  note "QA test request (ai:qa-token-request)"
  period 2026-10 · limit 100,000 · used 0 · available 100,000
  current_balance.available_tokens 100,000 (from_free_pool)
```

The review screen opens it, pre-fills 100,000 from `suggested_tokens`, and —
worth saying — **raises the "this account already has tokens" banner**, which
is correct: `available_tokens` is 100,000. That banner exists for the case
where a request sat in the queue across the 1st and the renewal already
answered it. Your QA command skips the "has this account run out?" check, so
the row looks exactly like that case. Nothing to fix; it is the warning doing
its job on the one row that has it.

**We have not approved or rejected it.** Two reasons, and neither is caution
for its own sake:

1. it is the only row in the queue, and it is what our side is using to look
   at the screen;
2. approve, reject and the 409 are three different paths and one row tests
   one of them.

**Please run the command twice more** — one more patient and the tourist. With
three rows we will approve one, reject one, click the third twice for the
`409`, and then check the allocation, the quota and the notification the way
your document lays out. Same day you make them.

## 2. The doctors block mixes two periods

Your brief does not say it, and the numbers do not survive being read
together. Default window, production, right now:

```
doctors: { active_doctors 2, tokens_used 0,
           allocated_tokens 152,380, remaining_tokens 96,060 }
```

`152,380 − 96,060 = 56,320` tokens are gone, beside `tokens_used: 0`.

It is not a bug in the data — it is two periods in one block. We checked:

```
GET /admin/ai/allocations   (doctors)  Σ consumed_tokens = 56,320
GET /admin/ai/overview?from=2020-01-01&to=2026-12-31
                                       doctors.tokens_used = 56,320
```

So `tokens_used` follows the window while `allocated_tokens` and
`remaining_tokens` are the whole life of those grants. An admin reading the
block as one period concludes the doctors used nothing and that 56,320 tokens
vanished.

We did not change the numbers. Each one is **labelled with the period it
belongs to** ("used in the chosen period", "granted in total (all time)"), and
a line underneath says why they differ. The free pool gets the same treatment
— your brief says it ignores the window, so it sits in its own block that says
"these are current figures, they do not follow the dates above".

**If you would rather fix it at the source**, the clean split is either to
window all three or to return `allocated_tokens_in_period` beside the lifetime
ones. Tell us and we will drop the explanatory line.

## 3. An unknown filter does not fail — it quietly returns the wrong list

This one is worth a change on your side.

```
GET /admin/ai/usage?charged_to=allocation     200 · total 83  (the whole log)
GET /admin/ai/usage?emergency_detected=1      200 · total 83  (the whole log)
GET /admin/ai/usage?risk_level=emergency      200 · total 83  (the whole log)
GET /admin/ai/usage?status=failed             200 · total 0
GET /admin/ai/usage?status=ok&status=blocked  200 · total 0
```

An unknown parameter is ignored and an unknown `status` value matches nothing.
Both answer `200`. A screen that offered any of those controls would show an
unfiltered list under a filter chip, or an empty one, and look right doing it.

So our usage screen offers **only** `from`, `to`, `module`, `status` and
`user_id`, which we verified actually filter:

```
?module=nutrition   9     ?user_id=10              7
?status=ok          34    ?from=2026-10-22&to=…    1
?per_page=500       capped at 100, as documented
```

Two asks:

1. **422 on an unknown `status`** rather than an empty list. An empty queue
   and a mistyped filter must not look the same.
2. **A way to ask for "everything that failed."** Either `status` accepting
   several values, or a `failed` shorthand. Right now your overview's
   `failed_requests` tile is the one number on the screen that cannot be
   opened: no single `status` expresses it. Ours links to the log for the same
   dates instead, which is the honest approximation.

And, if they are cheap, `charged_to` and `emergency_detected` as real filters
— the overview puts both numbers on screen, so they are the two people will
try to click next.

## 4. What the first real reading showed

Not a complaint, just what is on the dashboard now, in case nobody has looked:

```
last 30 days: 84 requests · 49 did not answer (58%)
  insufficient_data 38 · quota_exceeded 9 · provider_error 1 · invalid_output 1
  icu_emergency: 40 requests, 35 errors — an 87.5% error rate
  emergencies detected: 10
```

The screen shows the failure rate under the tile and marks any module over 50%
in red, because 58% is the first thing an admin should see rather than
something they work out. `insufficient_data` being the biggest bucket suggests
a prompt or an input problem rather than a quota one — your area, not ours,
but it is the loudest signal in the data.

## 5. What we built

- `/dashboard/ai/overview` — date range (7/30/90 and explicit dates), tiles,
  the pool meter, the patients and doctors blocks, and the per-module table
  from `usage/summary`, each module linking to its own log for the same dates.
- `/dashboard/ai/usage` — the log, with the five filters above. **The filters
  live in the URL**, because the screen is linked into from two places and a
  reloaded link has to show the same rows.
- `/dashboard/ai/allocations` — the grants, with the `source` filter, the
  consumed/remaining bar, and the manual grant behind `ai.manage`. The form
  says on it that a grant made there notifies nobody and that approving the
  request is the door that tells the patient.
- **The links you asked for in §4**, from a token request: the refusals that
  led to it (`status=quota_exceeded`), the account's whole usage, and its
  grants — carrying `allocation_id` as `highlight`, so an approved request
  opens the list pointing at the row it created.
- Module keys are rendered through `/admin/ai/modules` in both languages.
  `status_label` and the request's `status_label` are **not** used: they are
  English only, and half this dashboard is Arabic.

Measured in both languages against the real endpoints — no stubs — and under
three pretended permission levels:

| pretended access | overview / usage / grants | grant button |
|---|---|---|
| `ai.manage` | all three open | present |
| `ai.view` | all three open | **absent** |
| no `ai` | **`/dashboard/no-access`** ×3 | absent, and nothing in the sidebar |

Four screens now, so the sidebar entry became a section. A dropdown whose
children are all hidden is dropped entirely, so this adds nothing for an admin
without the area.

## 6. Your other answers, checked

- **`ai.tourist_monthly_tokens`** is `100000`, `is_default false`, written
  `2026-10-22 11:11:35`. Confirmed. Tourists can now run out, so
  `suggested_tokens` will arrive as a number for them and the amount field
  pre-fills like a patient's.
- **`reviewed_by` is an object or null** — our renderer already accepted
  either that or a plain string; the string branch stays as a cheap guard and
  costs nothing.
- **`period` is a month label** — understood, and we will not convert it. It
  is printed as `2026-10` today. Formatting it as "October 2026" needs Arabic
  month names, which this dashboard does not carry yet (every date on it
  renders in English). That is its own small piece of work; say if you want it
  prioritised.
- **The installer and the gate** — thank you for checking both files return
  200. That is exactly the order we needed.

## 7. One thing the QA row cannot test

`GET /admin/ai/usage?user_id=54` returns **0 rows**. The QA command skips the
"has this account run out?" check, so the account has no AI history at all —
and the "refusals that led to this request" link, which is the one your §4
asks for, lands on an empty log for the only request we have.

Not a defect in either of us. It does mean that link is unverified against
real data, and will stay that way until a request exists from an account that
actually ran out.
