# Website → backend: your second note, measured (2026-10-04)

Everything below was measured against `https://api.hayaihealthcare.com/api/v1`
and against our SSR build rendering from it, today.

---

## First: the release you described as "not released yet" is live

Both of the signals you gave us fire:

- `GET /admin/website/settings` lists `seo.min_reviews_for_rating`
  (`type: "int"`, `value: 5`, `is_default: true`).
- `GET /public/en/products?sort=price` returns 200.

So items 2, 4 and 5 are in production. We re-measured all of them and they are
correct — details under "Confirmed working" below. Nothing is owed on them.

---

## 1. Sitemap is missing every indexable listing URL

`sitemap-en.xml` has **6 URLs**: `/en` plus the five CMS pages
(insurance-coverage, emergency-icu, how-it-works, faq, about).

These are served `index, follow, max-image-preview:large` and are **absent**:

| URL | robots meta |
|---|---|
| `/en/doctors` | `index, follow` |
| `/en/doctors/critical-care` | `index, follow` |
| `/en/doctors/dentistry` | `index, follow` |
| `/en/products` | `index, follow` |

The specialty pages are the ones that matter most: they are the pages with a
real query behind them ("critical care doctors in Egypt") and they now have
their own title, breadcrumb and `CollectionPage`. A page that is indexable and
not in the sitemap is a page we are asking Google to find by luck.

Please either list them, or make them `noindex` — but the two signals should
agree. Same question for `/ar`.

Thin doctor profiles are correctly excluded, and the two test doctors (#3, #4)
are `noindex` and not in the sitemap. That part works.

## 2. `resolve` does not say which query a path facet maps to

This cost us a bug, so it is worth a field.

`/en/doctors/critical-care` resolves to `kind: "listing"`, `listing: "doctors"`,
`title: "Critical Care Medicine doctors"` — but nothing in the payload says
"this is `specialty=critical-care`". We were calling
`GET /public/en/doctors` with the URL's own (empty) query, so the specialty
page rendered **all 8 doctors** under the h1 "Doctors", with a canonical
pointing back at `/en/doctors`. Three different URLs, one page.

We have fixed it on our side with a hard-coded map (`doctors → specialty`),
driven off your canonical for `?specialty=`. That map is a guess that happens
to be right. It will be wrong the first time a second facet exists, or the
first time products or articles get one.

**What we would like:** `resolve`, for `kind: "listing"`, returns the query to
fetch the listing with. Any of these works:

```json
"data": { "listing": "doctors", "listing_query": "specialty=critical-care" }
```
```json
"data": { "listing": "doctors", "query": { "specialty": "critical-care" } }
```

Then we pass it straight through and delete the map. If you would rather we
keep deriving it, say so and we will leave it — but then please tell us the
full set of path facets you intend to support, per listing.

## 3. `/public/{locale}/hospitals` 404s

Your note lists `/hospitals` among the listing calls that now carry
`breadcrumbs` / `schema` / `schema_script`. It currently returns 404.

We believe this is correct and is `directory.hospitals_public = false`
gating it — doctors is on, hospitals is off. Please confirm, and confirm it
answers 200 with the same shape the moment the setting is switched on, because
the owner will switch it on without warning us and we would rather not find
out then.

(Our listing resolver already treats a 4xx as an empty list rather than a 503,
so the page degrades to "no results" instead of an error. It is not urgent.)

---

## Confirmed working — measured, no action needed

**`seo.min_reviews_for_rating`.** Our settings screen already renders `int` as
a number input and sends a real JSON number, so no UI change was needed. Full
round trip:

| sent | result |
|---|---|
| `5` | 200 |
| `0` | 422 `"Must be a whole number from 1 to 1000."` |
| `1001` | 422, same message |
| `5.5` | 422, same message |
| `"7"` | 200 |

The 422 is keyed `seo.min_reviews_for_rating`, which our form maps to the
field, so the message lands under the input. We left the value at **5**
(`is_default: true`).

**Listings (§3).** `/en/doctors` carries `MedicalOrganization` +
`BreadcrumbList` + `CollectionPage` with `mainEntity: ItemList`. Positions
continue across pages — with `per_page=3`, page 1 is 1–3 and page 2 is 4–6, as
you said. `/en/products` has no `ItemList` because it has no rows; that is the
right behaviour, not a gap.

**Specialty pages.** `?specialty=critical-care` →
title `"Critical Care Medicine doctors | HAYAI"`, breadcrumb
`Home › Doctors › Critical Care Medicine`, canonical
`https://hayaihealthcare.com/en/doctors/critical-care`. Arabic is localised
(`أطباء العناية المركزة`). The path form and the query form now converge on the
same canonical. We also moved the listing h1 onto your `title`, so a specialty
page no longer shares the section's h1.

**Doctor payloads (§2).** `schema_script` is filled on `kind: "doctor"`.
The profile renders `MedicalOrganization` + `BreadcrumbList` + `Physician`.
We have **deleted our fallback**, as you asked, and verified the profile still
renders without it.

**Home (§4).** `BreadcrumbList` present on `/en` and `/ar`, alongside
`MedicalOrganization` and `WebSite`.

**Ratings (§1).** No doctor on production ships an `aggregateRating` at the
default threshold. Our deploy gate now fails only on `reviewCount: 0` and warns
between 1 and 4, rather than failing under 5 — your setting is the real
control, and a gate that goes red on honest data is a gate people learn to
skip.

**QA logins.** `Qa Physician Hayai` is no longer listed. The directory returns
8 doctors.

---

## One thing for the owner, not for you

Doctors #3 `doctor account test` and #4 `doctor test` are live in the public
directory at positions 4 and 5 of `/en/doctors`. They are `noindex` and out of
the sitemap, so this is not an SEO problem — but a visitor browsing the
directory sees two entries called "doctor test". We are raising it with the
owner; no action needed from you unless they ask for the accounts to be
un-approved.
