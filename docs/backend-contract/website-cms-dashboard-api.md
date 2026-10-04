# HAYAI Website CMS — Dashboard API (as built, 2026-10-02)

> Contract for the **admin dashboard "Website" section**: pages, landing pages, blog,
> products, hospital partner purchases, leads, forms, FAQs, authors, media, SEO/GEO,
> redirects, robots / sitemap / llms.txt, analytics and audit.
> Section 18 is a short appendix on the **public** API the server-rendered website uses,
> so dashboard previews can show exactly what the site will render.

---

## 0. Conventions (read first)

| | |
|---|---|
| Base URL | `{API_HOST}/api/v1/admin/website` |
| Auth | `Authorization: Bearer <admin token>` + `Accept: application/json` (token from `POST /api/v1/auth/login`) |
| Envelope | `{ "success": true, "message": "…", "data": …, "meta": { … } }` |
| Lists | `?page=1&per_page=25` → `meta.pagination = {current_page, per_page, total, last_page, from, to}` |
| Errors | `{ "success": false, "message": "…", "errors": { "field": ["reason"] } }` — `401` no token, `403` not allowed, `404` not found, `422` validation, `429` rate limit |
| IDs / keys | integers; snake_case fields; ISO-8601 timestamps; plain dates `YYYY-MM-DD` |
| Languages | `en`, `ar` (Arabic is RTL). Every localized thing is edited **per language**. |
| Uploads | `multipart/form-data`. For an update that carries a file use `POST` on the same URL (PHP cannot parse multipart on PATCH). |

The app adds `<field>_label` next to some raw values (e.g. `status` → `status_label` in the
`Accept-Language` language). Always **switch on the raw value**, display the label.

### 0.1 Permissions (granular, fail-closed)

Every endpoint below names one permission. An admin without it gets:

```json
{ "success": false, "message": "You do not have permission to do this.",
  "error_code": "WEBSITE_PERMISSION_DENIED", "required_permission": "cms.publish" }
```

Load the current admin's permissions once and hide what they cannot do:

`GET /me` (any admin) →
```json
{ "data": { "id": 1, "name": "Mona", "email": "mona@hayai.com",
  "roles": ["publisher"], "permissions": ["cms.view","cms.create","cms.update","cms.publish", "…"] } }
```

All permissions: `cms.view cms.create cms.update cms.delete cms.publish · seo.view seo.update ·
products.view products.create products.update products.delete · orders.view orders.create orders.update ·
leads.view leads.update leads.delete · media.view media.upload media.delete ·
redirects.view redirects.create redirects.update redirects.delete · analytics.view ·
settings.view settings.update · audit.view · roles.manage`

Built-in roles: `super-admin` (everything), `content-editor`, `publisher`, `seo-manager`,
`sales-manager`, `analyst`. Every admin that existed at deploy time is `super-admin`; new
admins have **no** website access until given a role (section 16).

### 0.2 Dropdown values

`GET /enums` (cms.view) returns every enum the screens need — use it instead of hardcoding:

```json
{ "data": {
  "locales": [{"code":"en","name":"English","native":"English","dir":"ltr","hreflang":"en","is_default":true},
              {"code":"ar","name":"Arabic","native":"العربية","dir":"rtl","hreflang":"ar","is_default":false}],
  "page_types": ["home","page","landing","article"],
  "content_statuses": ["draft","scheduled","published","unpublished","archived"],
  "product_statuses": ["draft","published","archived"],
  "pricing_types": ["fixed","starting_from","contact_for_price","custom_quote"],
  "availability": ["available","limited","coming_soon","unavailable"],
  "billing_periods": ["one_time","monthly","quarterly","yearly"],
  "cta_types": ["purchase","contact","request_demo","become_partner","book","check_coverage","call","whatsapp","external_link","internal_page","custom_form"],
  "cta_placements": ["hero","sticky_desktop","sticky_mobile","product_card","pricing","sidebar","article","bottom","popup","inline","header","footer"],
  "form_types": ["contact","hospital_partnership","request_demo","request_quote","purchase_inquiry","general_inquiry","custom"],
  "form_field_types": ["text","email","phone","number","select","multi_select","textarea","checkbox","radio","file"],
  "form_field_maps_to": ["name","email","phone","organization","hospital","country","city","job_title","message"],
  "lead_statuses": [{"value":"new","next":["contacted","qualified","converted","closed","spam"]}, "…"],
  "purchase_statuses": [{"value":"submitted","next":["under_review","approved","rejected","canceled"],"requires_reason":false}, "…"],
  "media_kinds": ["image","document","video"],
  "block_types": ["hero","rich_text","…"],
  "analytics_events": ["page_view","cta_click","…"],
  "paths": {"products":"products","authors":"authors","doctors":"doctors","hospitals":"hospital-directory","search":"search"},
  "reserved_prefixes": ["products","authors","doctors","hospital-directory","search","account","requests","api","preview","admin","sitemap","robots.txt","llms.txt"]
}}
```

### 0.3 Dashboard home

`GET /overview` (cms.view) →
```json
{ "data": { "website_url": "https://hayai.app",
  "pages": {"published": 12, "draft": 3}, "scheduled": [{"id":7,"title":"Ramadan offer","publish_at":"2026-10-10T08:00:00+00:00"}],
  "products": {"published": 4}, "leads": {"new": 9, "contacted": 4}, "leads_new_7d": 6,
  "purchases": {"submitted": 2, "approved": 1}, "purchases_open": 2 } }
```

---

## 1. How content works (the mental model)

1. **Working copy vs live copy.** Everything you edit (languages, blocks, SEO, GEO, FAQs, CTAs)
   is the *working copy*. The website shows the **last published version**. Saving never
   changes the live site — **Publish** does. `GET /pages/{id}` returns
   `has_unpublished_changes` so the UI can show "You have unpublished changes".
2. **Statuses:** `draft → (scheduled) → published → unpublished / archived`. A live page keeps
   status `published`; scheduling a re-publish of a live page keeps it live until then.
3. **Every publish creates an immutable version** (`v1, v2…`). Versions can be previewed,
   compared and restored into the working copy (then re-published).
4. **URLs** are `/{locale}/{parent path}/{slug}`. Slugs: lowercase letters, digits, hyphens
   (or Arabic letters). Changing a live page's slug and publishing creates an automatic
   **301 redirect** from the old URL.
5. **Products are edited live** (a price fix must reach the site at once) but every save is
   still versioned and price changes are audited.
6. **Preview** never touches the live site and is always `noindex`.

---

## 2. Pages (Home, Hospitals, Partner With HAYAI, Pricing, any landing page, articles)

Type: `home` (only one), `page`, `landing`, `article` (blog / resources — see section 9).

### 2.1 List — `GET /pages` (cms.view)

Filters: `type`, `status`, `locale` (has that language), `parent_id`, `author_id`, `category_id`,
`q` (title / path contains), `trashed=with|only`, `sort=updated|created|published|sort_order`.

Each row:
```json
{ "id": 3, "type": "landing", "template": "default", "status": "published", "is_live": true,
  "parent_id": 2, "author_id": null, "category_id": null, "featured_media_id": null,
  "is_featured": false, "sort_order": 0, "settings": null,
  "publish_at": null, "unpublish_at": null,
  "first_published_at": "2026-10-02T18:40:59+00:00", "last_published_at": "2026-10-02T18:40:59+00:00",
  "published_version_id": 3, "created_at": "…", "updated_at": "…", "deleted_at": null,
  "translations": [
    { "locale": "ar", "title": "كن شريكًا لحياة", "subtitle": null, "excerpt": null, "slug": "شريك-حياة",
      "path": "المستشفيات/شريك-حياة", "url": "https://hayai.app/ar/%D8%A7…", "is_enabled": true,
      "published_path": "المستشفيات/شريك-حياة", "live_url": "https://hayai.app/ar/%D8%A7…",
      "content_updated_at": "…" },
    { "locale": "en", "title": "Partner with HAYAI", "slug": "partner-with-hayai",
      "path": "hospitals/partner-with-hayai", "published_path": "hospitals/partner-with-hayai", "…": "…" } ] }
```

### 2.2 Create — `POST /pages` (cms.create)

```json
{
  "type": "landing",
  "template": "default",
  "parent_id": 2,
  "translations": {
    "en": { "title": "Partner with HAYAI", "slug": "partner-with-hayai", "excerpt": "Short summary" },
    "ar": { "title": "كن شريكًا لحياة", "slug": "شريك-حياة" }
  }
}
```
- `translations`: at least one language. `title` required (it is the page **H1**). `slug` optional
  (made from the title). Other fields: `subtitle`, `excerpt`, `body` (sanitized HTML), `tags[]`, `is_enabled`.
- Optional page fields: `author_id`, `category_id` (article category), `featured_media_id`,
  `is_featured`, `sort_order`, `settings` (free object ≤ 5 KB for the frontend template).
- `422` for: a reserved first segment (`account`, `products`, … see enums), a URL already used
  by another page, an invalid slug (`Bad_Slug`), a second home page.

Returns `201` with the full page (section 2.3 shape). New pages are always `draft`.

### 2.3 Get one — `GET /pages/{id}` (cms.view)

Row fields + per language: `body`, `tags`, `sections[]`, `seo`, `geo`; plus `author`, `category`,
`featured_media`, `sources[]`, `faqs[]`, `ctas[]`, and:
```json
"has_unpublished_changes": true,
"publish_errors": { "translations.en.geo.direct_answer": ["Articles need a self-contained 40-60 word direct answer (GEO)."] }
```
`publish_errors` is `{}` when the page can be published — use it to enable/disable **Publish**.

### 2.4 Update page fields — `PATCH /pages/{id}` (cms.update)

Any of: `type`, `template`, `parent_id` (moving re-paths the page and its children), `author_id`,
`category_id`, `featured_media_id`, `is_featured`, `sort_order`, `settings`.

### 2.5 Languages

| Action | Call | Permission |
|---|---|---|
| Create / update one language | `PUT /pages/{id}/translations/{locale}` `{title, slug?, subtitle?, excerpt?, body?, tags?, is_enabled?}` | cms.update |
| Delete one language | `DELETE /pages/{id}/translations/{locale}` (not the last one) | cms.update |

`is_enabled: false` keeps the language as a draft that is **not** published.
`body` may not contain `<h1>` (the title is the only H1).

### 2.6 Blocks (page builder) — see section 3 for the block catalogue

| Action | Call | Permission |
|---|---|---|
| List a language's blocks | `GET /pages/{id}/translations/{locale}/sections` | cms.view |
| **Save the whole list** (recommended) | `PUT /pages/{id}/translations/{locale}/sections` `{ "sections": [ {type, data, anchor?, settings?, is_enabled?}, … ] }` — array order = display order | cms.update |
| Add one | `POST /pages/{id}/translations/{locale}/sections` `{type, data, anchor?, settings?, is_enabled?, position?}` | cms.update |
| Reorder | `POST /pages/{id}/translations/{locale}/sections/reorder` `{ "ids": [12, 9, 15] }` (every id exactly once) | cms.update |
| Edit / enable / disable one | `PATCH /sections/{sectionId}` `{data?, anchor?, settings?, is_enabled?}` | cms.update |
| Delete one | `DELETE /sections/{sectionId}` | cms.update |

Section object: `{ "id": 12, "type": "hero", "anchor": "top", "data": {…}, "settings": {"hide_on":["mobile"],"theme":"brand","spacing":"compact"}, "sort_order": 0, "is_enabled": true }`

- `anchor`: lowercase, starts with a letter (`pricing`, `faq-2`) → in-page links `#pricing`.
- `settings`: only `hide_on` (`mobile`/`desktop`), `theme` (`default|light|dark|brand|muted`),
  `spacing` (`none|compact|normal|spacious`).
- Validation errors point at the exact field: `errors["sections.1.data.headline"]`,
  `errors["sections.0.data.primary_cta"]`.
- Only **one** hero per language may set `is_h1: true`.

### 2.7 SEO, GEO, sources, FAQs, CTAs of a page

| Action | Call | Permission |
|---|---|---|
| SEO of one language | `GET` / `PUT /pages/{id}/seo/{locale}` | seo.view / seo.update |
| GEO of one language | `GET` / `PUT /pages/{id}/geo/{locale}` | seo.view / seo.update |
| Sources (citations) | `PUT /pages/{id}/sources` `{ "sources": [ … ] }` (replaces) | cms.update |
| Attached FAQs | `PUT /pages/{id}/faqs` `{ "faq_ids": [4, 9] }` (order = display order) | cms.update |
| Attached CTAs | `PUT /pages/{id}/ctas` `{ "ctas": [ {"cta_id": 3, "placement": "sticky_mobile", "is_enabled": true} ] }` | cms.update |

SEO body (all optional):
```json
{ "meta_title": "Partner with HAYAI | Hospital partnerships in Egypt",
  "meta_description": "Hospitals partner with HAYAI to receive insured patients …",
  "canonical_url": null, "robots_index": true, "robots_follow": true, "robots_extra": "max-snippet:-1",
  "focus_topic": "hospital partnership",
  "og_title": null, "og_description": null, "og_image_media_id": 12, "og_type": "website",
  "twitter_card": "summary_large_image", "twitter_title": null, "twitter_description": null, "twitter_image_media_id": null,
  "custom_schema": { "@type": "MedicalWebPage", "specialty": "Dermatology" } }
```
- Empty `meta_title` → the site uses `<title> + " | HAYAI"`; empty description → excerpt / direct answer.
- `robots_index: false` = noindex **and** removed from the sitemap.
- `custom_schema`: extra JSON-LD (one object or a list, each with `@type`). **Rejected**: any
  `aggregateRating` / `review` / `rating` key, a non-schema.org `@context`, > 20 KB.

GEO body (answer-engine content):
```json
{ "direct_answer_question": "Does my insurance cover a dermatologist visit in Egypt?",
  "direct_answer": "Most private Egyptian health insurance policies cover outpatient dermatologist visits up to the annual outpatient limit of the policy. HAYAI checks …",
  "key_facts": [ {"label": "Check time", "value": "Under two minutes", "source_url": "https://…"} ],
  "entity": { "type": "MedicalOrganization", "name": "HAYAI", "description": "…", "same_as": ["https://…"] },
  "last_verified_at": "2026-10-01" }
```
- `direct_answer` must be **40–60 words**, plain text, and must **not start** with "It/This/These/هذا…"
  (it has to make sense on its own). The UI should show a live word counter.

Source item: `{ "locale": "en"|null (null = all languages), "title": "…", "url": "https://…", "organization": "FRA", "published_on": "2026-01-01", "verified_on": "2026-10-01" }`

### 2.8 Publishing

| Action | Call | Permission |
|---|---|---|
| Publish now | `POST /pages/{id}/publish` `{ "label": "Launch copy" }` (label optional) | cms.publish |
| Unpublish | `POST /pages/{id}/unpublish` | cms.publish |
| Schedule | `POST /pages/{id}/schedule` `{ "publish_at": "2026-10-10T08:00:00+02:00", "unpublish_at": null }` | cms.publish |
| Cancel a schedule | `POST /pages/{id}/schedule` `{ "publish_at": null, "unpublish_at": null }` | cms.publish |
| Archive | `POST /pages/{id}/archive` | cms.publish |

- Publish returns the page plus `published_version` and `live_urls: {"en": "https://hayai.app/en/…"}`.
- Publish `422` lists every blocker (same as `publish_errors`): missing title, URL taken,
  invalid block, two H1 heroes, parent page not live, article without an active author or
  without a 40–60 word direct answer.
- Scheduled times run every minute. Times in the past → `422` (use Publish).

### 2.9 Delete, restore, duplicate

| Action | Call | Permission |
|---|---|---|
| Move to trash | `DELETE /pages/{id}` (refused if it has child pages, or if it is the live home page) | cms.delete |
| Restore | `POST /pages/{id}/restore` (refused if its URL is now used by another page) | cms.delete |
| Duplicate | `POST /pages/{id}/duplicate` → new draft, slugs get `-copy` | cms.create |

Trash list: `GET /pages?trashed=only`.

### 2.10 Versions

| Action | Call | Permission |
|---|---|---|
| List | `GET /pages/{id}/versions` → `[{id, version, event (saved/published/scheduled/restored), label, created_by:{id,name}, created_at, is_published}]` | cms.view |
| Save a named version | `POST /pages/{id}/versions` `{ "label": "Before legal review" }` | cms.update |
| View (full snapshot) | `GET /pages/{id}/versions/{v}` | cms.view |
| Compare | `GET /pages/{id}/versions/{a}/compare/{b}` (b = number or `current`) | cms.view |
| Restore into working copy | `POST /pages/{id}/versions/{v}/restore` (then publish) | cms.update |

Compare response:
```json
{ "data": { "from": 1, "to": 2, "diff": {
  "added":   { "translations.ar.sections.3.type": "faq" },
  "removed": {},
  "changed": { "translations.en.title": { "from": "Partner with HAYAI", "to": "Partner with HAYAI today" } } } } }
```

### 2.11 Preview

| Action | Call | Permission |
|---|---|---|
| Render the draft in the dashboard | `GET /pages/{id}/preview?locale=en&version=` (version optional) | cms.view |
| Shareable preview link (60 min) | `POST /pages/{id}/preview-token` `{locale, version?}` | cms.view |

The preview response is exactly the public page payload (section 18) with
`is_preview: true` and `seo.robots: "noindex, nofollow"`. The token response:
```json
{ "data": { "token": "eyJpdiI6…", "expires_at": "…",
  "api_endpoint": "/api/v1/public/preview/eyJpdiI6…?locale=en",
  "preview_url": "https://hayai.app/preview?token=eyJpdiI6…&locale=en" } }
```

### 2.12 SEO / GEO checklist — `GET /pages/{id}/seo-audit?locale=en` (seo.view)

```json
{ "data": [ { "locale": "en", "score": 80, "checks": [
  { "key": "publishable", "level": "error", "passed": true, "message": "Ready to publish." },
  { "key": "seo_title_length", "level": "warning", "passed": false, "message": "SEO title is 72 characters (aim for 30-60)." },
  { "key": "meta_description", "level": "warning", "passed": true, "message": "…" },
  { "key": "indexable", "level": "warning", "passed": true, "message": "Indexable." },
  { "key": "single_h1", "level": "error", "passed": true, "message": "Exactly one H1 …" },
  { "key": "heading_order", "level": "warning", "passed": true, "message": "Heading levels are in order." },
  { "key": "direct_answer", "level": "warning", "passed": false, "message": "No direct answer (40-60 words) …" },
  { "key": "image_alt", "level": "warning", "passed": true, "message": "…" },
  { "key": "last_verified", "level": "warning", "passed": false, "message": "…" },
  { "key": "hreflang", "level": "warning", "passed": true, "message": "Both languages exist …" } ] } ] }
```
Articles add `author`, `author_profiles`, `sources`, `featured_image`. Show errors red, warnings amber.

---

## 3. Block catalogue (page builder)

`GET /blocks` (cms.view) describes every block type and its fields — **build the block
editor forms from it**:

```json
{ "data": [ { "type": "hero", "label": "Hero", "category": "layout",
  "description": "Top-of-page headline, supporting text, image and up to two CTAs …",
  "fields": [
    { "key": "eyebrow", "type": "text", "required": false, "max": 100 },
    { "key": "headline", "type": "text", "required": true, "max": 200 },
    { "key": "subheadline", "type": "textarea", "required": false, "max": 500 },
    { "key": "is_h1", "type": "boolean", "required": false },
    { "key": "image_media_id", "type": "media", "required": false },
    { "key": "primary_cta", "type": "cta", "required": false },
    { "key": "secondary_cta", "type": "cta", "required": false },
    { "key": "alignment", "type": "select", "required": false, "options": ["start","center"] } ] }, "…" ] }
```

Field types → editor widget:

| type | widget / value |
|---|---|
| `text`, `textarea` | plain text (HTML is stripped) |
| `html` | rich-text editor; allowed: p, h2–h6, lists, links, strong/em, blockquote, code, img, **table** markup. No h1, scripts, styles, iframes. |
| `url` | `https://…`, a site path `/en/…`, `#anchor`, `mailto:`, `tel:` |
| `media` | media-library picker → media id |
| `cta` | either `{ "cta_id": 3 }` (library CTA) **or** inline `{ "label": "Call us", "url": "tel:+20…", "style": "primary|secondary|outline|link", "target": "_self|_blank", "tracking_key": "hero.call" }` |
| `select` | one of `options` |
| `integer`, `number`, `boolean` | as named |
| `product` / `products` | product picker (id / ids) |
| `faqs` | FAQ picker (ids) |
| `form` | form picker → form **key** (e.g. `hospital-partnership`) |
| `page`, `pages`, `category`, `author` | pickers (ids) |
| `string_list` | list of short texts |
| `cells` | table row cells: text, `true`/`false` (✓/✗) or null — one per column |
| `matrix` | rows × columns of text |
| `list` | repeatable group; its `item_fields` describe each item |

The 27 block types:

| type | what it is | key fields |
|---|---|---|
| `hero` | headline + image + 2 CTAs | `headline`*, `is_h1`, `image_media_id`, `primary_cta`, `secondary_cta` |
| `rich_text` | sanitized HTML | `html`*, `heading` |
| `direct_answer` | Q + 40–60 word answer | `question`*, `answer`* |
| `feature_grid` | cards grid | `items[] {title*, description, icon, media_id, link}`, `columns` |
| `feature_list` | vertical list | `items[] {title*, description, icon}` |
| `pricing` | price tiers | `product_id` (live tiers) **or** `tiers[] {name*, price, currency, billing_period, features[], is_recommended, cta}` |
| `product_grid` | products | `product_ids[]` or `category_id` (else featured), `limit`, `show_price` |
| `product_card` | one product | `product_id`*, `layout: card|horizontal|buy_box` |
| `comparison_table` | real `<table>` | `caption`*, `columns[] {key,label}`*, `rows[] {label, cells[]}`* |
| `table` | generic table | `caption`*, `headers[]`*, `rows` (matrix)* |
| `faq` | Q&A | `source: attached|global|selected|group`, `faq_ids`, `group_key`, `limit`, `include_in_schema` |
| `cta` | CTA banner | `cta`*, `secondary_cta`, `heading`, `text`, `variant` |
| `contact_form` | embedded form | `form_key`* |
| `purchase_cta` | buy box | `product_id`*, `cta`, `show_price`, `layout` |
| `hospital_partner_cta` | partnership pitch + form | `heading`*, `benefits[]`, `form_key` (default `hospital-partnership`), `cta`, `media_id` |
| `testimonial` | quotes | `items[] {quote*, author_name*, author_title, organization, media_id}` |
| `statistic` | figures | `items[] {value*, label*, description, source_url}` |
| `image` | one image | `media_id`*, `caption`, `link_url`, `size` |
| `video` | YouTube / Vimeo / uploaded | `title`*, `provider`*, `url` or `media_id`, `poster_media_id`, `transcript` |
| `logo_grid` | partner logos | `items[] {media_id*, name*, url}` |
| `steps` | how it works (ordered) | `items[] {title*, description}` |
| `benefits` | benefits | `items[] {title*, description, icon}` |
| `article_list` | live articles | `source: latest|featured|category|author|selected`, `category_id`, `author_id`, `page_ids`, `limit` |
| `doctor_list` | directory doctors | `specialty`, `limit` (empty unless the doctor directory is public) |
| `hospital_list` | directory hospitals | `icu_only`, `limit` (empty unless the hospital directory is public) |
| `custom_link` | one link | `label`*, `url`*, `description`, `target` |
| `breadcrumbs` | breadcrumbs here | — |

`*` = required. Testimonials never become review stars in search results (by design).

---

## 4. CTAs (reusable calls to action)

| Action | Call | Permission |
|---|---|---|
| List | `GET /ctas?type=&placement=&q=` | cms.view |
| Get (with EN/AR render preview) | `GET /ctas/{id}` | cms.view |
| Create | `POST /ctas` | cms.create |
| Update | `PATCH /ctas/{id}` | cms.update |
| Delete | `DELETE /ctas/{id}` (refused while a block references it — disable instead) | cms.delete |

Body:
```json
{ "key": "buy-icu-live", "type": "purchase", "label_en": "Get ICU live", "label_ar": "اشترك الآن",
  "sublabel_en": "From EGP 4,500 / month", "product_id": 1, "placement": "sidebar",
  "style": "primary", "icon": "cart", "tracking_key": "cta.buy-icu-live", "is_enabled": true }
```
What each `type` needs: `call`/`whatsapp` → `phone` (+ `message_en/ar` WhatsApp prefill);
`external_link` → absolute `url`; `internal_page` → `page_id` (or `url`); `custom_form` → `form_id`;
`purchase` → `product_id` (or `url`); `book`/`check_coverage` → `page_id` or `url`;
`contact` / `request_demo` / `become_partner` open the matching system form unless `form_id` is set.
`tracking_key` defaults to `cta.{key}` — it is what CTA conversion reports group by.

Where CTAs appear: attach them to a **page** (`PUT /pages/{id}/ctas`), a **product**
(`PUT /products/{id}/relations` → `ctas`), a **menu** for sitewide CTAs
(`PUT /menus/{key}/ctas`, e.g. a sticky mobile "WhatsApp us"), or reference them in blocks.
The **placement** chosen at attach time decides where the site renders them
(sidebar buy box next to the product info, sticky mobile bar, hero, popup …).

---

## 5. Products / services (the B2B catalog)

| Action | Call | Permission |
|---|---|---|
| List | `GET /products?status=&category_id=&type=&q=&trashed=with|only` | products.view |
| Get | `GET /products/{id}` | products.view |
| Create | `POST /products` | products.create |
| Update | `PATCH /products/{id}` (any subset; `translations`, `tiers`, `gallery` replace when sent) | products.update |
| Delete language | `DELETE /products/{id}/translations/{locale}` | products.update |
| Trash / restore | `DELETE /products/{id}` · `POST /products/{id}/restore` | products.delete |
| SEO / GEO | `GET`/`PUT /products/{id}/seo/{locale}` · `PUT /products/{id}/geo/{locale}` (bodies as section 2.7) | seo.view / seo.update |
| Sources, FAQs, CTAs | `PUT /products/{id}/relations` `{ "sources": […], "faq_ids": […], "ctas": [ {cta_id, placement, is_enabled} ] }` (send only what changes) | products.update |
| Preview (+ share link) | `GET /products/{id}/preview?locale=en` | products.view |
| Versions | `GET /products/{id}/versions` · `GET …/versions/{v}` · `GET …/versions/{a}/compare/{b|current}` · `POST …/versions {label}` · `POST …/versions/{v}/restore` | products.view / products.update |

Create / update body:
```json
{ "type": "service", "sku": "ICU-LIVE", "status": "published", "category_id": 1,
  "pricing_type": "fixed", "price": 4500, "compare_at_price": null, "currency": "EGP",
  "billing_period": "monthly", "is_price_public": true,
  "availability": "available", "is_featured": true, "is_purchasable": true,
  "min_quantity": 1, "max_quantity": 50, "subscription_plan_id": null,
  "featured_media_id": 12, "gallery": [12, 13], "sort_order": 0,
  "translations": {
    "en": { "name": "ICU live availability", "slug": "icu-live-availability",
            "short_description": "…", "description": "<p>…</p>",
            "features": [ {"title": "Real-time bed status", "description": null} ],
            "specifications": [ {"label": "Setup time", "value": "48 hours"} ], "is_enabled": true },
    "ar": { "name": "إتاحة العناية المركزة لحظيًا", "slug": "إتاحة-العناية-المركزة" } },
  "tiers": [ { "name_en": "Essential", "name_ar": "أساسي", "price": 4500, "billing_period": "monthly",
               "features_en": ["ICU listing"], "features_ar": [], "is_recommended": false, "is_active": true } ] }
```
- **Prices are private unless `is_price_public: true`** and the pricing type is `fixed` or
  `starting_from`. `contact_for_price` / `custom_quote` never show a figure. The dashboard
  always sees the stored price.
- `status: published` needs at least one enabled language.
- Changing any price field writes a `product.price_changed` audit row with old and new values.
- Public product URL: `https://hayai.app/{locale}/products/{slug}`.

Categories (shared with articles, `kind` = `product` | `article`):

| Action | Call | Permission |
|---|---|---|
| List | `GET /categories?kind=product` | cms.view |
| Create | `POST /categories` `{kind, name_en, name_ar?, slug_en?, slug_ar?, description_en?, description_ar?, parent_id?, sort_order?, is_active?}` | cms.create |
| Update | `PATCH /categories/{id}` (kind cannot change) | cms.update |
| Delete | `DELETE /categories/{id}` (refused while used — deactivate instead) | cms.delete |

---

## 6. Hospital partners & purchases (orders)

Hospitals / organisations buy from the catalog through **purchase requests**. They are the
orders: there is no payment gateway or invoicing in the platform yet, so contract, invoice and
payment happen offline between `approved` and `completed`.

State machine (the only way to change status is the status endpoint):

```
submitted ─▶ under_review ─▶ approved ─▶ completed
    │               │            └──▶ canceled
    ├──▶ approved   ├──▶ rejected
    ├──▶ rejected   └──▶ canceled
    └──▶ canceled          (draft ─▶ submitted | canceled — buyer drafts only)
```
`rejected` and `canceled` need a `reason`. `rejected`, `canceled`, `completed` are final.

| Action | Call | Permission |
|---|---|---|
| List | `GET /purchases?status=&assigned_to=&hospital_id=&from=&to=&q=` (drafts hidden unless `status=draft`) | orders.view |
| Get | `GET /purchases/{id}` | orders.view |
| Change status | `POST /purchases/{id}/status` `{ "status": "approved", "reason": "Contract signed", "metadata": {"po": "PO-118"} }` | orders.update |
| Assign / notes | `PATCH /purchases/{id}` `{ "assigned_to": 5, "internal_notes": "…" }` | orders.update |
| Manual entry (phone / e-mail order) | `POST /purchases` — same body as the public form (section 18.4) + `consent: true` | orders.create |

List `meta.counts` = `{ "submitted": 3, "approved": 1, … }` for status tabs.

Purchase object:
```json
{ "id": 7, "reference": "PR-261002-82MBUZ", "status": "submitted", "status_label": "Submitted",
  "allowed_statuses": ["under_review","approved","rejected","canceled"],
  "organization_name": "Cairo General Hospital", "organization_type": "hospital",
  "contact_name": "Mona Adel", "email": "mona@hospital.example", "phone": "+201001234567",
  "job_title": null, "country": null, "city": null, "notes": "…",
  "currency": "EGP", "estimated_total": "9000.00", "has_unpriced_items": false,
  "items": [ { "id": 9, "product_id": 1, "price_tier_id": null, "product_name": "ICU live availability",
               "tier_name": null, "sku": "ICU-LIVE", "pricing_type": "fixed", "unit_price": "4500.00",
               "quantity": 2, "line_total": "9000.00", "currency": "EGP", "billing_period": "monthly", "notes": null } ],
  "decision_reason": null, "can_cancel": true,
  "submitted_at": "…", "decided_at": null, "completed_at": null, "canceled_at": null, "created_at": "…",
  "history": [ { "from_status": null, "to_status": "submitted", "reason": null, "actor": "customer",
                 "created_at": "…", "metadata": null, "performed_by": null } ],
  "user": null, "hospital_id": null, "organization_id": null,
  "assigned_to": { "id": 5, "name": "Sales" }, "internal_notes": null, "locale": "en", "consent": true,
  "attribution": { "session_id": "…", "utm_source": "google", "utm_campaign": "icu-launch",
                   "landing_page": "/en/products/icu-live-availability", "referrer": "…", "cta_id": 3 } }
```
- `has_unpriced_items: true` → at least one line has no public price ("to be quoted");
  `estimated_total` is then `null`.
- Prices are always computed by the server from the catalog at submission time and frozen on the item.
- `hospital_id` / `organization_id` are filled when the buyer was signed in with a HAYAI hospital /
  organisation account.
- New requests appear in the admin notification inbox (`website_purchase_submitted`) and are
  e-mailed to `WEBSITE_PURCHASE_NOTIFY_EMAILS`.

"Become a partner" applications are **leads** of type `hospital_partnership` (section 7).

---

## 7. Leads (contact, partnership, demo, quote, inquiries)

Every form submission is a lead. Types: `contact`, `hospital_partnership`, `request_demo`,
`request_quote`, `purchase_inquiry`, `general_inquiry`, `custom`.
Statuses: `new → contacted → qualified → converted → closed`, plus `spam`
(allowed moves are in `allowed_statuses` on each lead).

| Action | Call | Permission |
|---|---|---|
| List | `GET /leads?status=&type=&form_id=&assigned_to=&utm_campaign=&utm_source=&locale=&product_id=&page_id=&from=&to=&q=&exclude_spam=1` | leads.view |
| Get (audited) | `GET /leads/{id}` | leads.view |
| Update | `PATCH /leads/{id}` `{ "status": "contacted", "reason": "…", "assigned_to": 5, "internal_notes": "…" }` (any subset) | leads.update |
| Delete | `DELETE /leads/{id}` | leads.delete |
| Download attachment (audited) | `GET /leads/{id}/attachments/{index}` → file stream | leads.view |
| Export CSV (audited) | `GET /leads/export?{same filters}` → `text/csv` (UTF-8 BOM, opens in Excel) | leads.view |

`exclude_spam` defaults to true. List `meta.counts` = `{ "new": 9, "spam": 2, … }`.

Lead detail:
```json
{ "id": 14, "reference": "LD-261002-M8EDUP", "type": "hospital_partnership", "status": "new",
  "allowed_statuses": ["contacted","qualified","converted","closed","spam"],
  "form": { "id": 2, "key": "hospital-partnership", "name": "Partner with HAYAI" },
  "name": "Dr. Samir Fathy", "organization": null, "hospital": "Nile Hospital",
  "email": "samir@nile.example", "phone": "+20 100 123 4567", "country": null, "city": "Cairo",
  "job_title": "Medical director", "locale": "en", "assigned_to": null,
  "message": null,
  "data": { "name": "Dr. Samir Fathy", "organization_type": "hospital", "beds": 120, "…": "…" },
  "attachments": [ { "index": 0, "field": "license", "original_name": "license.pdf", "mime_type": "application/pdf",
                     "size": 102400, "download_url": "https://api…/api/v1/admin/website/leads/14/attachments/0" } ],
  "product": null, "page": { "id": 3, "title": "Partner with HAYAI" }, "cta": { "id": 1, "key": "partner-with-hayai", "tracking_key": "cta.partner-with-hayai" },
  "consent": true, "consent_at": "…",
  "attribution": { "session_id": "s-42", "utm_source": "linkedin", "utm_medium": "paid", "utm_campaign": "hospitals-q4",
                   "landing_page": "/en/hospitals", "referrer": "https://www.linkedin.com/" },
  "internal_notes": null, "spam_reason": null, "contacted_at": null, "converted_at": null, "closed_at": null,
  "history": [ { "from_status": null, "to_status": "new", "actor": "customer", "created_at": "…" } ] }
```
Spam: a filled honeypot stores the lead as `spam` silently (no alerts). Move `spam → new` to rescue one.

---

## 8. Forms (no-code form builder)

Six **system forms** exist from day one (keys `contact`, `hospital-partnership`, `request-demo`,
`request-quote`, `purchase-inquiry`, `general-inquiry`). Their fields can be edited; their key and
type cannot, and they cannot be deleted (deactivate instead).

| Action | Call | Permission |
|---|---|---|
| List (with `leads_count`) | `GET /forms` | cms.view |
| Get (with fields) | `GET /forms/{id}` | cms.view |
| Create | `POST /forms` | cms.create |
| Update (send `fields` to replace them all) | `PATCH /forms/{id}` | cms.update |
| Delete | `DELETE /forms/{id}` | cms.delete |
| Its submissions | `GET /leads?form_id={id}` | leads.view |

```json
{ "key": "icu-onboarding", "type": "custom", "name_en": "ICU onboarding", "name_ar": "تسجيل العناية",
  "description_en": null, "submit_label_en": "Send", "submit_label_ar": "إرسال",
  "success_message_en": "Thanks — we will call you.", "success_message_ar": "شكرًا، سنتواصل معك.",
  "requires_consent": true, "consent_text_en": "I agree …", "consent_text_ar": "أوافق …",
  "notify_emails": ["partners@hayai.com"], "is_active": true,
  "fields": [
    { "key": "email", "type": "email", "label_en": "Email", "label_ar": "البريد", "is_required": true, "maps_to": "email" },
    { "key": "has_icu", "type": "select", "label_en": "Do you run an ICU?", "is_required": true,
      "options": [ {"value": "yes", "label_en": "Yes", "label_ar": "نعم"}, {"value": "no", "label_en": "No", "label_ar": "لا"} ] },
    { "key": "icu_beds", "type": "number", "label_en": "ICU beds", "is_required": true,
      "validation": {"min": 1, "max": 500},
      "visibility": {"field": "has_icu", "operator": "equals", "value": "yes"} },
    { "key": "license", "type": "file", "label_en": "License (PDF)",
      "validation": {"mimes": ["pdf"], "max_kb": 2048, "max_files": 1} } ] }
```
Rules the API enforces (422 with `fields.{i}.…` keys):
- `key`: `snake_case`, unique in the form; reserved: `website`, `consent`, `attribution`, `product_id`, `product_slug`.
- `select` / `multi_select` / `radio` need options with unique values.
- `maps_to` fills a lead column (`name`, `email`, `phone`, `organization`, `hospital`, `country`, `city`,
  `job_title`, `message`); `email` only from an email field, `phone` only from a phone field; each column once.
- `visibility` must point at another field; operators `equals`, `not_equals`, `in`, `not_in`, `filled`, `empty`.
  A hidden field is neither required nor stored.
- `validation`: `min`, `max` (numbers), `min_length`, `max_length` (≤ 5000), `mimes`
  (subset of pdf, jpg, jpeg, png, doc, docx, xls, xlsx, csv), `max_kb` (≤ 10240), `max_files` (≤ 5).
- Uploaded files are stored privately (never public URLs) and downloaded through the lead endpoint.

---

## 9. Blog / resources and authors

Articles are pages with `type: "article"` — same editor, versions, preview, SEO/GEO (section 2).
Give the blog index page (a normal page, e.g. slug `blog`, with an `article_list` block) and set
articles' `parent_id` to it → URL `/en/blog/{slug}`.

Article-specific fields: `author_id` (**required to publish**), `category_id` (category with
`kind: article`), `featured_media_id`, `is_featured`, per language `excerpt`, `body`, `tags[]`.
Publishing an article also requires a 40–60 word **direct answer** in each enabled language.
Reading time and word count are computed automatically.

Authors (named, credentialed bylines — "HAYAI Team" is not acceptable for health content):

| Action | Call | Permission |
|---|---|---|
| List | `GET /authors?q=` (with `articles_count`) | cms.view |
| Get | `GET /authors/{id}` | cms.view |
| Create | `POST /authors` | cms.create |
| Update | `PATCH /authors/{id}` | cms.update |
| Delete | `DELETE /authors/{id}` (refused while they sign articles — deactivate instead) | cms.delete |

```json
{ "slug": "dr-hala-mostafa", "name_en": "Dr. Hala Mostafa", "name_ar": "د. هالة مصطفى",
  "job_title_en": "Medical advisor", "credentials_en": "MBBS, MSc Health Economics",
  "bio_en": "…", "bio_ar": "…", "photo_media_id": 21,
  "same_as": ["https://www.linkedin.com/in/…", "https://…syndicate profile…"],
  "email": "internal-only@hayai.com", "user_id": null, "is_active": true }
```
`email` is internal and never published. Public archive: `/{locale}/authors/{slug}`.

---

## 10. FAQs

| Action | Call | Permission |
|---|---|---|
| List | `GET /faqs?locale=&status=&is_global=&group_key=&q=` (with `used_by_pages`, `used_by_products`) | cms.view |
| Create | `POST /faqs` `{ "locale": "en", "question": "…", "answer": "<p>…</p>", "group_key": "coverage", "is_global": true, "status": "published", "sort_order": 0 }` | cms.create |
| Update | `PATCH /faqs/{id}` | cms.update |
| Delete | `DELETE /faqs/{id}` (detaches it everywhere) | cms.delete |

One FAQ = one language. `is_global` = shown on the FAQ page (`faq` block with `source: global`).
Attach to a page (`PUT /pages/{id}/faqs`) or product (`PUT /products/{id}/relations`). A page with
attached FAQs but no FAQ block gets an FAQ section at the end automatically. FAQs feed the
`FAQPage` structured data. The answer accepts basic HTML (paragraphs, lists, links, emphasis).

---

## 11. Media library

| Action | Call | Permission |
|---|---|---|
| List | `GET /media?kind=image|document|video&q=` | media.view |
| Upload | `POST /media` multipart: `file` + optional `alt_en`, `alt_ar`, `caption_en`, `caption_ar`, `focal_x`, `focal_y` (0–100) | media.upload |
| Get | `GET /media/{id}` | media.view |
| Edit text / focal point | `PATCH` or `POST /media/{id}` | media.upload |
| Where is it used? | `GET /media/{id}/usage` → `[{"type":"page","id":3}, …]` | media.view |
| Delete | `DELETE /media/{id}` (422 while used) | media.delete |

Accepted: jpg, jpeg, png, webp, gif (≤ 8 MB), pdf (≤ 20 MB), mp4, webm (≤ 100 MB). SVG is not
accepted. Uploading the same file twice returns the existing item. Images (not GIF) get WebP
variants at 400 / 800 / 1200 / 1600 px wide (only widths smaller than the original) plus a
full-size WebP, generated in the background — `variants_status` goes `pending → ready`
(`failed` if the image could not be processed). JPEG location metadata (EXIF) is stripped.

```json
{ "id": 12, "kind": "image", "url": "https://api…/storage/website/media/2026/10/9f1c….jpg",
  "mime_type": "image/jpeg", "width": 1600, "height": 900,
  "alt": "Dr. Amina Saleh, Dermatologist, Maadi Cairo", "caption": null, "focal_point": {"x": 50, "y": 30},
  "variants": [ {"width": 400, "height": 225, "url": "…-400.webp", "mime_type": "image/webp"}, "…" ],
  "srcset": "…-400.webp 400w, …-800.webp 800w, …",
  "filename": "9f1c….jpg", "original_name": "amina.jpg", "extension": "jpg", "size": 482113,
  "alt_en": "…", "alt_ar": "…", "caption_en": null, "caption_ar": null, "focal_x": 50, "focal_y": 30,
  "variants_status": "ready", "uploaded_by": 1, "created_at": "…" }
```
**Alt text is required for accessibility and SEO** — make the alt fields prominent and warn when empty.

---

## 12. Navigation menus & sitewide CTAs

| Action | Call | Permission |
|---|---|---|
| List menus | `GET /menus` | cms.view |
| Get one (both languages) | `GET /menus/{key}` (`header`, `footer`, or any key) | cms.view |
| Save one language's tree | `PUT /menus/{key}/items` `{ "locale": "en", "items": [ {"label": "For hospitals", "page_id": 2, "children": [ {"label": "Guides", "url": "/en/blog"} ]} ] }` | cms.update |
| Sitewide CTAs | `PUT /menus/{key}/ctas` `{ "ctas": [ {"cta_id": 4, "placement": "sticky_mobile"} ] }` | cms.update |

Items linking to a page (`page_id`) follow its live URL automatically and are hidden while the
page is not live. Two levels of nesting.

---

## 13. SEO / GEO settings, redirects, robots, sitemap, llms.txt

### 13.1 Website settings — `GET /settings` (settings.view) · `PATCH /settings` (settings.update)

`GET` returns `[{key, group, type, value, default, is_default, description, updated_by, updated_at}]`.
`PATCH` takes flat keys:
```json
{ "organization.same_as": ["https://instagram.com/hayai", "https://facebook.com/hayai"],
  "organization.logo_url": "https://cdn…/logo.png", "organization.phone": "+20 2 1234 5678",
  "directory.doctors_public": false }
```
Keys: `organization.name_en|name_ar|legal_name|description_en|description_ar|logo_url|same_as|phone|email|whatsapp|area_served`,
`seo.title_suffix_en|title_suffix_ar|default_og_image_url|twitter_site`, `llms.title|summary|notes`,
`directory.doctors_public|hospitals_public` (publish the in-app provider directory on the open web — off by default),
`analytics.enabled`, `legal.privacy_url`.

`POST /cache/flush` (settings.update) drops every cached public page (normally automatic on save).

### 13.2 Redirects

| Action | Call | Permission |
|---|---|---|
| List | `GET /redirects?is_active=&is_automatic=&q=` | redirects.view |
| Test a URL | `GET /redirects/test?path=/en/old` → final `{location, status_code}` or `null` | redirects.view |
| Create | `POST /redirects` `{ "source_path": "/en/old-page", "destination": "/en/new-page", "status_code": 301, "is_active": true, "notes": "…" }` | redirects.create |
| Update | `PATCH /redirects/{id}` | redirects.update |
| Delete | `DELETE /redirects/{id}` | redirects.delete |

Row: `{id, source_path, destination, status_code, is_active, is_automatic, hits, last_hit_at, notes, created_by, created_at}`.
`422` for: loops (A→B→A), a duplicate source, a source that is a live page, `javascript:`/`data:`
destinations, redirecting `/`. Sources are matched case-insensitively without query string.
`is_automatic: true` rows were created by slug changes on publish.

### 13.3 robots.txt

| Action | Call | Permission |
|---|---|---|
| Groups | `GET /robots/rules` | seo.view |
| Add | `POST /robots/rules` `{ "user_agent": "Bingbot", "allow": ["/"], "disallow": [], "block_all": false, "crawl_delay": null, "is_enabled": true, "notes": "…" }` | seo.update |
| Edit / delete | `PATCH` / `DELETE /robots/rules/{id}` | seo.update |
| Preview the file | `GET /robots/preview` → `{content, private_paths}` | seo.view |

Seeded groups: `*`, Googlebot, Bingbot, GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-User,
Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, CCBot — all allowed. Private paths
(`/account/`, `/requests/`, `/api/`, `/preview/` and their `/{locale}/…` forms) are repeated in **every**
group automatically. `block_all: true` blocks one crawler — warn loudly before allowing that for AI crawlers.

### 13.4 llms.txt

| Action | Call | Permission |
|---|---|---|
| Entries | `GET /llms/entries` | seo.view |
| Add | `POST /llms/entries` `{ "section": "Core", "title": "Check your coverage", "url": "/en/coverage", "description": "How the free coverage check works", "sort_order": 0 }` | seo.update |
| Edit / delete | `PATCH` / `DELETE /llms/entries/{id}` | seo.update |
| Preview | `GET /llms/preview` → `{ content, sections, excluded: [{id, title, url, reason}] }` | seo.view |

Internal URLs that are not a live page are **left out** of the file (shown in `excluded`).
Title and summary come from settings `llms.title` / `llms.summary`.

### 13.5 Sitemap — `GET /sitemap` (seo.view)

```json
{ "data": { "index_url": "https://hayai.app/sitemap_index.xml",
  "locales": [ { "locale": "en", "url": "https://hayai.app/sitemap-en.xml", "total": 8,
                 "by_type": {"page": 4, "article": 1, "product": 2, "author": 1}, "files": 1,
                 "lastmod": "2026-10-02T18:41:01+00:00" } ] } }
```
Only live, indexable, self-canonical URLs are listed (no drafts, noindex pages, filtered URLs or thin provider pages).

### 13.6 URL checker — `GET /seo/resolve-url?url=/en/doctors?spec=dermatology&sort=price` (seo.view)

```json
{ "data": { "canonical": "https://hayai.app/en/doctors/dermatology", "robots": "noindex, follow",
  "is_indexable": false, "reason": "facet_has_clean_url", "page": 1, "clean_path": "doctors/dermatology", "locale": "en" } }
```

### 13.7 AI-crawler visibility — `GET /crawlers?days=14` (analytics.view)

```json
{ "data": { "window_days": 14, "crawlers": [
  { "crawler": "GPTBot", "allowed": true, "last_seen_at": "2026-10-02T09:12:00+00:00", "hits_in_window": 37,
    "by_resource": {"page": 30, "robots": 4, "sitemap": 3}, "status": "ok" },
  { "crawler": "PerplexityBot", "allowed": true, "last_seen_at": null, "hits_in_window": 0, "by_resource": {}, "status": "no_recent_visits" } ] } }
```
`status`: `ok`, `no_recent_visits` (allowed but not seen in the window — investigate), `blocked`.

---

## 14. Analytics & conversions

All take `from` / `to` (dates; default last 30 days). Permission `analytics.view`.

| Report | Call | Rows |
|---|---|---|
| Summary | `GET /analytics/summary` | `{sessions, events: {page_view: n, …}, conversions, conversion_rate, leads, purchases, funnel: [{step, count}], daily: [{day, page_view, cta_click, …}]}` |
| CTAs | `GET /analytics/ctas` | `[{tracking_key, placement, clicks, conversions, conversion_rate}]` |
| Pages | `GET /analytics/pages` | `[{path, page_id, views, cta_clicks, conversions, conversion_rate}]` |
| Campaigns | `GET /analytics/campaigns` | `[{source, medium, campaign, views, conversions, purchases_completed}]` |
| Raw events | `GET /analytics/events?event=&session_id=&cta_tracking_key=` (paginated) | event rows |

Conversions = `contact_submitted`, `partner_request_submitted`, `quote_requested`, `demo_requested`,
`purchase_submitted`. `purchase_completed` is recorded when an admin completes a request.

---

## 15. Audit log

Website changes are in the dashboard audit log with what changed. Two doors to the same log:

- `GET /audit-logs` (under `/admin/website`, permission `audit.view`)
- `GET /api/v1/admin/audit-logs` (the existing platform endpoint, any admin)

Filters: `entity_type`, `entity_id`, `action` (exact, or prefix with `.*`: `action=page.*`), `admin_id`,
`method`, `path`, `from`, `to`, `per_page` (≤ 100). Example: `GET /audit-logs?entity_type=website_page&entity_id=3`.

New fields on each row: `action`, `entity_type`, `entity_id`, `old_values`, `new_values`.
```json
{ "id": 912, "admin": {"id": 1, "name": "Mona", "email": "…"}, "method": "PATCH",
  "path": "/api/v1/admin/website/products/1", "status": 200,
  "action": "product.price_changed", "entity_type": "website_product", "entity_id": 1,
  "old_values": {"price": "4500.00"}, "new_values": {"price": 5000}, "ip": "…", "created_at": "…" }
```
Entity types: `website_page`, `website_product`, `website_lead`, `website_purchase_request`, `website_cta`,
`website_form`, `website_faq`, `website_author`, `website_category`, `website_media`, `website_redirect`,
`website_menu`, `website_crawler_rule`, `website_llms_entry`, `website_settings`, `website_role`, `user`.
Actions (prefixes): `page.*` (created, updated, translation_saved, sections_saved, seo_updated, schema_changed,
geo_updated, published, unpublished, scheduled, archived, deleted, restored, duplicated, version_restored, …),
`product.*` (price_changed, status_changed, …), `order.status_changed`, `lead.status_changed`, `lead.assigned`,
`redirect.*`, `media.*`, `form.*`, `cta.*`, `settings.changed`, `role.*`, `admin.roles_changed`.
Lead notes and contact details are never copied into the log (only that they changed).

---

## 16. Roles & admins (permission `roles.manage`)

| Action | Call |
|---|---|
| All permissions | `GET /permissions` → `{all: […], grouped: {cms: […], seo: […], …}}` |
| Roles | `GET /roles` → `[{id, name, is_system, permissions, admins_count}]` |
| Create role | `POST /roles` `{ "name": "blog-writer", "permissions": ["cms.view","cms.create","cms.update"] }` |
| Edit role | `PATCH /roles/{id}` (`super-admin` cannot be edited) |
| Delete role | `DELETE /roles/{id}` (refused while held) |
| Admin accounts | `GET /admins` → `[{id, name, email, status, roles}]` |
| Set an admin's roles | `PUT /admins/{userId}/roles` `{ "roles": ["publisher"] }` (the last super-admin cannot lose it) |

---

## 17. Suggested screen map

| Dashboard menu | Main calls |
|---|---|
| Pages (Home, Hospitals, Partner With HAYAI, Pricing, landing pages) | `GET /pages?type=…`, editor = sections 2–3, preview 2.11, audit 2.12 |
| Products / Services | section 5 |
| Hospital Partners | `GET /leads?type=hospital_partnership` + `GET /purchases?hospital_id=` |
| Purchases / Orders | section 6 |
| Leads | section 7 |
| Forms | section 8 |
| FAQs | section 10 |
| Blog / Resources | `GET /pages?type=article` + section 9 |
| Authors | section 9 |
| Media | section 11 |
| SEO / GEO | per-page SEO/GEO tabs (2.7), settings (13.1), URL checker (13.6) |
| Redirects | 13.2 |
| Sitemap / Robots / LLMs | 13.3–13.5, crawler visibility 13.7 |
| Analytics / Conversions | 14 |
| Audit Logs | 15 |
| Settings / Roles | 13.1, 16 |

---

## 18. Appendix — public website API (what the site renders)

Base: `{API_HOST}/api/v1/public`. No auth. The language is the `{locale}` path segment (`en`/`ar`),
never `Accept-Language`. Responses carry `Cache-Control`, `ETag` (send `If-None-Match` → `304`).
The SSR website server should send `X-Website-Key: <WEBSITE_SERVER_KEY>` so it is not rate-limited
as a single IP.

### 18.1 One call per URL

`GET /{locale}/resolve?path=/hospitals/partner-with-hayai&qs=page%3D2` →
`{ kind: page|product|author|doctor|hospital|listing|redirect|not_found, status: 200|301|302|404, data, redirect }`.
For `redirect`, issue the HTTP redirect to `redirect.location` with `status`.
`qs` (optional) = the page's own query string, so canonical / robots are adjusted for `?page=` / filters.

Direct calls also exist: `GET /{locale}/pages/{path}` ('' = home), `GET /{locale}/products/{slug}`,
`GET /{locale}/authors/{slug}`, `GET /{locale}/site` (menus, organisation, sitewide CTAs, locales).

### 18.2 Page payload (also what dashboard preview returns)

```json
{ "entity": "page", "id": 3, "type": "landing", "template": "default", "settings": null,
  "locale": "en", "lang": "en", "dir": "ltr",
  "slug": "partner-with-hayai", "path": "/en/hospitals/partner-with-hayai", "url": "https://hayai.app/en/hospitals/partner-with-hayai",
  "title": "Partner with HAYAI", "subtitle": null, "excerpt": null,
  "h1": { "text": "Partner with HAYAI", "source": "hero", "section_id": 31 },
  "body": null, "tags": [], "word_count": 120, "reading_time_minutes": null,
  "author": null, "category": null, "featured_image": null,
  "geo": { "direct_answer": { "question": "…", "answer": "…", "word_count": 52 }, "key_facts": [], "entity": null, "last_verified_at": "2026-10-01" },
  "sections": [ { "id": 31, "type": "hero", "anchor": null, "settings": null, "data": { "headline": "…",
      "image": { "url": "…", "width": 1600, "height": 900, "alt": "…", "srcset": "…", "variants": [ … ] },
      "primary_cta": { "id": 1, "key": "partner-with-hayai", "type": "become_partner", "label": "Become a partner",
        "style": "primary", "placement": "hero", "tracking_key": "cta.partner-with-hayai",
        "action": { "kind": "form", "href": null, "target": "_self", "rel": null, "form_key": "hospital-partnership", "product": null } } } },
    { "id": 33, "type": "purchase_cta", "data": { "product": { "name": "ICU live availability",
        "pricing": { "type": "fixed", "price": "4500.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
        "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" } },
      "ctas": { "sidebar": [ … ], "sticky_mobile": [ … ] },
      "purchase": { "enabled": true, "endpoint": "/api/v1/public/en/purchases", "product_id": 1, "min_quantity": 1, "max_quantity": 50 } } } ],
  "ctas": { "sticky_mobile": [ … ] },
  "forms": { "hospital-partnership": { "key": "…", "fields": [ … ], "submit_endpoint": "/api/v1/public/en/forms/hospital-partnership/submissions", "honeypot_field": "website" } },
  "sources": [ … ], "breadcrumbs": [ {"name": "Home", "url": "https://hayai.app/en", "path": "/en"}, … ],
  "related": [], "children": [],
  "dates": { "published_at": "…", "modified_at": "…", "display_published": "Published 2 October 2026", "display_modified": "Updated October 2026", "last_verified_at": "…" },
  "seo": { "title": "…", "description": "…", "canonical": "https://hayai.app/en/hospitals/partner-with-hayai",
           "robots": "index, follow, max-image-preview:large", "is_indexable": true,
           "alternates": [ {"hreflang": "en", "href": "…", "locale": "en"}, {"hreflang": "ar", "href": "…"}, {"hreflang": "x-default", "href": "…"} ],
           "open_graph": { … }, "twitter": { … } },
  "schema": [ {"@type": "MedicalOrganization", …}, {"@type": "BreadcrumbList", …}, {"@type": "WebPage", …}, {"@type": "FAQPage", …} ],
  "schema_script": "{\"@context\":\"https://schema.org\",\"@graph\":[…]}",
  "version": 3, "etag": "…", "is_preview": false }
```
Rendering rules for the site: everything above is in the HTML on first response (no client-side
fetch for indexable content); `<html lang dir>` from `lang` / `dir`; one `<h1>` = `h1.text`; the GEO
direct answer right after the H1 in `<section aria-label="direct-answer" data-geo="answer">`; tables
as `<table>`; show `dates.display_modified`; print `seo.*` in `<head>`; print `schema_script` as-is
inside one `<script type="application/ld+json">`; CTA behaviour from `action.kind`.

### 18.3 Forms & leads

`GET /{locale}/forms/{key}` → definition. Submit:
`POST /{locale}/forms/{key}/submissions` (or `POST /{locale}/leads` with `"type": "hospital_partnership"` for system forms):
```json
{ "fields": { "name": "…", "email": "…", "hospital": "…" }, "consent": true, "website": "",
  "attribution": { "session_id": "…", "utm_source": "…", "utm_medium": "…", "utm_campaign": "…",
                   "landing_page": "/en/hospitals?utm_source=…", "referrer": "…", "cta_tracking_key": "cta.partner-with-hayai", "page_id": 3 } }
```
`201 { reference, type, status: "received", duplicate, message }`. Files: multipart `fields[license]`.
Rate limit: 5/minute, 30/hour per visitor.

### 18.4 Purchases

`POST /{locale}/purchases` (header `Idempotency-Key: <uuid>` recommended):
```json
{ "items": [ {"product_id": 1, "quantity": 2, "price_tier_id": null, "notes": null} ],
  "organization_name": "Cairo General Hospital", "organization_type": "hospital",
  "contact_name": "Mona Adel", "email": "mona@hospital.example", "phone": "+201001234567",
  "job_title": null, "country": "Egypt", "city": "Cairo", "notes": null, "consent": true,
  "save_as_draft": false, "attribution": { … } }
```
`201` → purchase object + `tracking: {token, endpoint}` (shown once). Guests track with
`GET /purchases/{reference}?token=…` and cancel with `POST /purchases/{reference}/cancel {token, reason}`.
Signed-in buyers: `GET /me/purchases`, `GET|PATCH /me/purchases/{reference}` (drafts),
`POST /me/purchases/{reference}/submit`, `POST /me/purchases/{reference}/cancel`.

### 18.5 Events, crawler files, everything else

- `POST /events` `{ "events": [ {"event": "cta_click", "session_id": "…", "path": "/en/…", "cta_tracking_key": "…", "placement": "hero", "utm_campaign": "…"} ] }` (≤ 25 per call, always `202`).
- Crawler files to serve at the **website root** by proxy: `/robots.txt` → `GET /robots.txt`, `/llms.txt` → `GET /llms.txt`,
  `/sitemap_index.xml` → `GET /sitemap_index.xml`, `/sitemap-en.xml` → `GET /sitemap-en.xml` (and `-ar`).
- Redirect map for an edge middleware: `GET /redirects`; one path: `GET /redirects/resolve?path=`.
- Listings: `GET /{locale}/articles?category=&author=&page=`, `GET /{locale}/products?category=&type=&featured=&q=&sort=&page=`
  (`meta.seo` gives canonical/robots for filters), `GET /{locale}/categories`, `GET /{locale}/faqs?group=`,
  `GET /{locale}/search?q=` (always noindex).
- Directory (only when enabled in settings): `GET /{locale}/doctors?specialty=`, `/doctors/{slug}`, `/hospitals`, `/hospitals/{slug}`.
- Preview links: `GET /preview/{token}?locale=` (noindex, never cached).
- Crawler visits seen at the website edge: `POST /crawler-hits` with `X-Website-Key` `{ "hits": [ {"user_agent": "…", "path": "/en/…", "resource": "page", "count": 1} ] }`.
