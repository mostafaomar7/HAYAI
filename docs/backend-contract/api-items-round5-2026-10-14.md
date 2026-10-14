# API items, round 5 — 2026-10-14

One new item, and one QA leftover to add to the list you already have.
Everything else from the QA round is front-end and is already deployed.

## 18. A navigation menu cannot be deleted

`DELETE /admin/website/menus/{key}` is not routed:

```
DELETE /api/v1/admin/website/menus/zzz-probe-does-not-exist   405 Method Not Allowed
```

(405 rather than 404, so it is the verb that is missing, not the key.)

**How a menu gets created.** The Navigation Menus screen has an "Other menu
key" box. Typing a key and saving items under it is what brings the menu into
existence — `PUT /admin/website/menus/{key}/items` creates it. That is the
only way to make one, and it is deliberate.

**What that costs.** A typo in that box is permanent. `GET /admin/website/menus`
on production right now answers:

```
["footer", "header", "qa-test-mm"]
```

`qa-test-mm` is a QA leftover from the current round. There is no way to remove
it from the dashboard or from the API, so it will stay in that list, and in the
tab strip of that screen, for as long as the table does.

**What we did on our side.** Saving a key that is not in `GET /menus` yet now
asks first, names the key, and says it cannot be deleted afterwards. That stops
the next typo; it does not clear this one.

**Asked for:** `DELETE /admin/website/menus/{key}`, refusing `header` and
`footer` (the site renders those by key) and any key a page still references,
with the usual 409 and a message. If you would rather keep menus
undeletable, say so and we will drop the confirmation to a plain note instead —
but then `qa-test-mm` needs removing by hand.

## Leftover list — one more

Adding to the seven already in round 3:

| # | what | where |
|---|---|---|
| 8 | menu `qa-test-mm` | `GET /admin/website/menus` |

Same question as the rest: delete, or keep as a fixture?

## Not an item — two things we checked and found sound

**Validation messages name the request field, not the screen field.** An
invalid menu link answers:

> The items.0.url must be an http(s) URL, a site path starting with '/', an
> anchor, mailto or tel.

`items.0.url` is our request body's shape, so this is correct of you and only
wrong of us — we were printing it unchanged. We now drop the leading attribute
from the sentence, since the message already renders under the field it
belongs to. Nothing needed at your end. Mentioning it so nobody "fixes" the
attribute name server-side and breaks the field binding, which is keyed on
exactly that path.

**Focal point.** `focal_x` / `focal_y` out of 0–100 were being clamped by us
before the request was sent, so a typed 150 was saved as 100 and read back as a
number the admin never chose. We now refuse it in the form instead. We did not
test what your end does with 150, because we no longer send it — if your
validator does not already bound it, it is worth adding.
