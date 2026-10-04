# HAYAI Website — public block payloads (contract)

> As built and deployed 2026-10-03. This file **is** §18.6 of `website-cms-dashboard-api.md`
> (moved out so it can be shared on its own). Every example is **real API output**: the backend
> test suite renders a page holding all 27 block types and these are the responses, shortened only
> in two ways: images keep one `variants` entry (real ones have up to five), forms keep two `fields`,
> and media file names are shortened.

---

## 1. Where blocks come from

| Call | Blocks are at |
|---|---|
| `GET /api/v1/public/{locale}/resolve?path=…` when `data.kind` is `"page"` | `data.data.sections` |
| `GET /api/v1/public/{locale}/pages/{path}` | `data.sections` |
| Dashboard preview `GET /admin/website/pages/{id}/preview` · `GET /public/preview/{token}` | `data.sections` |

Products (`kind: "product"`) have no blocks: the product page payload has its own fields
(`gallery: Image[]`, `tiers`, `ctas`, `purchase`, `faqs`, …).

## 2. Rules (apply to every block)

1. **Envelope.** Each entry of `sections` is:

   | key | type | can be null? | notes |
   |---|---|---|---|
   | `id` | integer | yes | `null` only for the automatic FAQ section (§3). Changes whenever the editor re-saves the blocks: use it for tracking, not as a cache key. |
   | `type` | string | no | one of the 27 types in §6. An unknown type (added later) → **skip it**, never crash. |
   | `anchor` | string | yes | put it on the block's `id` attribute (`#pricing` links). |
   | `settings` | object | yes | `{ "hide_on": ("mobile"\|"desktop")[], "theme": "default"\|"light"\|"dark"\|"brand"\|"muted"\|null, "spacing": "none"\|"compact"\|"normal"\|"spacious"\|null }` — all three keys always present when the object is. |
   | `data` | object | no | the block fields below. |

2. **Every field listed for a block is always present in `data`.** Nothing is ever missing.
   An empty value is `null`, `[]` (list fields), `false` (booleans) or the field's listed default.
   Same inside list items.
3. ✱ marks a key the **server adds** (resolved image, product, form, …). Fields of type **Cta**
   are replaced in place by the resolved CTA object. Fields holding an id (`media_id`,
   `product_id`, …) stay, and the resolved object sits next to them.
4. **Plain text vs HTML.** Only `rich_text.html` and `Faq.answer` are HTML — already sanitized
   by the server. `Faq.answer` allows `p br strong b em i u s small sub sup span ul ol li a`;
   `rich_text.html` additionally allows `h2–h6 blockquote pre code hr figure figcaption img table caption
   thead tbody tfoot tr th td`. Never `h1`, scripts, styles, iframes or `on*` attributes. Render those as HTML. **Everything else is plain text: escape it.**
5. **Omitted blocks.** A block whose required content disappeared (unpublished product, deleted
   image, inactive form, …) is left out of `sections` rather than sent half-empty. Disabled blocks
   are never sent. `sections` is already in display order.
6. **One language.** Every string is already in the URL's language. There are no `_en` / `_ar` keys.
7. **Money** is always a decimal string (`"4500.00"`) or `null`. Always print the ready-made `display`
   string; don't format prices yourself.
8. **Empty maps are `{}`**, never `[]` (`ctas`, `validation`, page-level `forms`).

## 3. The automatic FAQ section

When FAQs are attached to a page but no `faq` block shows them, the server appends one at the end:
`{ "id": null, "type": "faq", "anchor": "faq", … "data": { "heading": "Frequently asked questions", "source": "attached", … } }`.

## 4. Your list → our block types

| you asked about | block type(s) |
|---|---|
| hero | `hero` |
| rich_text | `rich_text` (+ `direct_answer` for the GEO answer box) |
| faq | `faq` |
| cta / buttons | `cta` block; buttons inside any block are **Cta** objects (§5.2) |
| pricing / products | `pricing`, `product_grid`, `product_card`, `purchase_cta` |
| gallery | **no gallery block.** Use several `image` blocks, or `logo_grid` for logos. Product pages have `gallery: Image[]` in their own payload. |
| stats | `statistic` |
| testimonials | `testimonial` |
| steps | `steps` |
| features | `feature_grid`, `feature_list`, `benefits` |
| logos | `logo_grid` |
| contact / form | `contact_form`, `hospital_partner_cta`; a Cta with `action.kind: "form"` opens page-level `forms[action.form_key]` |
| tables | `comparison_table`, `table` |
| media | `image`, `video` |
| dynamic lists | `article_list`, `doctor_list`, `hospital_list` |
| navigation | `custom_link`, `breadcrumbs` |

## 5. Shared objects

### 5.1 Image

| key | type | can be null? | notes |
|---|---|---|---|
| `id` | integer | no | |
| `kind` | `"image"` \| `"video"` | no | `video` only in `video.video` |
| `url` | string | no | original file |
| `mime_type` | string | no | |
| `width`, `height` | integer | yes | always set for images |
| `alt` | string | no | `""` = decorative image (`alt=""`) |
| `caption` | string | yes | plain text |
| `focal_point` | `{ x: 0-100, y: 0-100 }` | yes | for `object-position: x% y%` |
| `variants` | `{ width, height, url, mime_type: "image/webp" }[]` | no | ascending width (400/800/1200/1600, only those smaller than the original). `[]` for a few seconds after upload while they are generated. |
| `srcset` | string | yes | ready for `<img srcset>`; `null` while `variants` is `[]` → fall back to `url` |

### 5.2 Cta (every button / link)

| key | type | can be null? | notes |
|---|---|---|---|
| `id` | integer | yes | `null` for an inline (one-off) CTA |
| `key` | string | yes | `null` for an inline CTA |
| `type` | string | no | `inline`, or a library type: `purchase contact request_demo become_partner book check_coverage call whatsapp external_link internal_page custom_form` |
| `label` | string | no | |
| `sublabel` | string | yes | |
| `style` | `primary` \| `secondary` \| `outline` \| `link` | no | |
| `icon` | string | yes | icon name |
| `placement` | string | yes | where it was attached (`hero`, `sidebar`, `sticky_mobile`, …) |
| `tracking_key` | string | no | send it with the `cta_click` event |
| `action.kind` | `link` \| `form` \| `purchase` \| `tel` \| `whatsapp` | no | **switch on this only** |
| `action.href` | string | yes | URL / path / `tel:` / `https://wa.me/…`. A `form` CTA may have none. |
| `action.target` | `_self` \| `_blank` | no | |
| `action.rel` | string | yes | `noopener noreferrer` for external links |
| `action.form_key` | string | yes | `form`: open `forms[form_key]` (page level) |
| `action.product` | `{ id, slug, path }` | yes | `purchase`: start the purchase flow for this product |

**CtaGroups** = `{ "<placement>": Cta[] }`, e.g. `{ "sidebar": [ … ], "sticky_mobile": [ … ] }`; `{}` when none.

### 5.3 ProductSummary, Pricing, Tier, PurchaseBox

**ProductSummary**

| key | type | can be null? | notes |
|---|---|---|---|
| `id` | integer | no | |
| `type` | `product` \| `service` | no | |
| `sku` | string | yes | |
| `name`, `slug`, `path`, `url` | string | no | `path` = `/en/products/{slug}`, `url` = absolute |
| `short_description` | string | yes | plain text |
| `image` | **Image** | yes | |
| `category` | **Category** | yes | |
| `pricing` | **Pricing** | no | |
| `availability` | `{ status, label, schema_org }` | no | `status`: `available` \| `limited` \| `coming_soon` \| `unavailable`; `label` is localized |
| `is_featured`, `is_purchasable` | boolean | no | |
| `quantity` | `{ min: integer, max: integer\|null }` | no | |

**Pricing**: `{ type: "fixed"|"starting_from"|"contact_for_price"|"custom_quote", price: string|null,
compare_at_price: string|null, currency: string, billing_period: "one_time"|"monthly"|"quarterly"|"yearly"|null,
display: string }`. `price` is `null` when the price is private or the block hides prices; `compare_at_price`
is only set when it is higher than `price` (show it struck through).

**Tier** (a catalog product's tier): `{ id: integer, name: string|null, description: string|null,
price: string|null, currency: string, billing_period: string|null, display: string, min_quantity: integer|null,
features: string[], is_recommended: boolean }`.

**PurchaseBox**: `{ enabled: boolean, endpoint: string, product_id: integer, min_quantity: integer,
max_quantity: integer|null, pricing: Pricing, availability: {…}, fallback_form_key: "purchase-inquiry" }`.
When `enabled` is false, open `forms["purchase-inquiry"]` instead of the purchase flow.

### 5.4 Form and FormField

**Form**: `{ key: string, type: string, name: string|null, description: string|null, submit_label: string,
success_message: string|null, requires_consent: boolean, consent_text: string|null, privacy_url: string|null,
honeypot_field: "website", submit_endpoint: string, fields: FormField[] }`.

**FormField**

| key | type | can be null? | notes |
|---|---|---|---|
| `key` | string | no | submit as `fields[{key}]` |
| `type` | `text email phone number select multi_select textarea checkbox radio file` | no | |
| `label` | string | no | |
| `placeholder`, `help` | string | yes | |
| `required` | boolean | no | |
| `validation` | object | no | `{}` or any of `min`, `max` (numbers), `min_length`, `max_length` |
| `visibility` | `{ field, operator, value }` | yes | show only when the condition holds; operators `equals not_equals in not_in filled empty` |
| `options` | `{ value, label }[]` | no | `[]` except select / multi_select / radio |
| `accept` | string[] | yes | file fields only (extensions), else `null` |
| `max_kb`, `max_files` | integer | yes | file fields only, else `null` |

### 5.5 Faq, Article, Author, Category, Breadcrumb

- **Faq**: `{ id: integer, question: string (plain), answer: string (HTML), group_key: string|null }`
- **Article**: `{ id, type: "article", title: string, excerpt: string|null, path, url, image: Image|null,
  author: Author|null, category: Category|null, tags: string[], reading_time_minutes: integer|null,
  is_featured: boolean, published_at: ISO-8601 string, modified_at: ISO-8601 string|null }`
- **Author**: `{ id, slug, name: string|null, job_title: string|null, credentials: string|null, bio: string|null
  (always null inside article lists), photo: Image|null, same_as: string[], url, path }`
- **Category**: `{ id, kind: "product"|"article", name: string|null, slug: string|null, description: string|null, parent_id: integer|null }`
- **Breadcrumb**: `{ name: string, url: string (absolute), path: string }`

### 5.6 Doctor and Hospital (directory blocks; empty while the directory is private)

- **Doctor**: `{ entity: "doctor", id, slug, name: string, image: string (URL)|null, specialty: { name, slug }|null,
  subspecialty: string|null, job_title: string|null, years_of_experience: integer|null, location: string|null,
  is_verified: boolean, rating: { average: number, count: integer }|null, path, url, url_path }`
  — note `image` here is a plain URL string, not an **Image** object.
- **Hospital**: `{ entity: "hospital", id, slug, name: string, logo: string (URL)|null, address: string|null,
  location: string|null, phone: string|null, emergency_number: string|null, icu_available: boolean,
  specialties: string[], path, url, url_path }`

---

## 6. The 27 blocks

Columns: **can be null?** — "no" means the value is never `null` (it may still be `""`, `[]` or `false`).

### `hero` — Hero

Top-of-page headline, supporting text, image and up to two CTAs. Set is_h1 when the headline (not the page title) is the page H1.

| field | type | can be null? | notes |
|---|---|---|---|
| `eyebrow` | string (plain text) | yes | max 100 chars |
| `headline` | string (plain text) | no | max 200 chars |
| `subheadline` | string (plain text) | yes | max 500 chars |
| `is_h1` | boolean | no — default `false` |  |
| `image_media_id` | integer (media id — use the resolved object below) | yes |  |
| `primary_cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `secondary_cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `alignment` | string: `start` \| `center` | yes |  |
| `image` ✱ | **Image** | yes | resolved `image_media_id` |

Example:

```json
{
  "id": 1,
  "type": "hero",
  "anchor": "top",
  "settings": {
    "hide_on": [],
    "theme": "brand",
    "spacing": "spacious"
  },
  "data": {
    "eyebrow": "For hospitals",
    "headline": "Fill your ICU beds with insured patients",
    "subheadline": "Publish live bed availability and receive pre-approved insurance referrals.",
    "is_h1": true,
    "image_media_id": 1,
    "primary_cta": {
      "id": 1,
      "key": "request-demo",
      "type": "request_demo",
      "label": "Request a demo",
      "sublabel": "30-minute call",
      "style": "primary",
      "icon": "calendar",
      "placement": "hero",
      "tracking_key": "cta.request-demo",
      "action": { "kind": "form", "href": null, "target": "_self", "rel": null, "form_key": "request-demo", "product": null }
    },
    "secondary_cta": {
      "id": null,
      "key": null,
      "type": "inline",
      "label": "Call sales",
      "sublabel": null,
      "style": "secondary",
      "icon": null,
      "placement": null,
      "tracking_key": "section.1.hero.secondary",
      "action": { "kind": "tel", "href": "tel:+20225550000", "target": "_self", "rel": null, "form_key": null, "product": null }
    },
    "alignment": "start",
    "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": { "x": 50, "y": 40 },
      "variants": [
        { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    }
  }
}
```

### `rich_text` — Rich text

Sanitized HTML: paragraphs, h2-h6, lists, links, images, real <table> markup. No <h1>, scripts or styles.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `html` | string (**HTML**, sanitized) | no | max 200000 chars |

Example:

```json
{
  "id": 2,
  "type": "rich_text",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Why hospitals choose HAYAI",
    "html": "<h3>Insurance-aware referrals</h3><p>Patients arrive with <strong>verified coverage</strong>. See the <a href=\"/en/pricing\" rel=\"noopener noreferrer\">pricing</a>.</p><ul><li>No paperwork</li><li>Faster admissions</li></ul>"
  }
}
```

### `direct_answer` — Direct answer

A question and a self-contained 40-60 word answer that still makes sense when extracted alone (no "it/this" referring back).

| field | type | can be null? | notes |
|---|---|---|---|
| `question` | string (plain text) | no | max 300 chars |
| `answer` | string (plain text) | no | max 1000 chars |
| `word_count` ✱ | integer | no |  |

Example:

```json
{
  "id": 3,
  "type": "direct_answer",
  "anchor": null,
  "settings": null,
  "data": {
    "question": "Does my insurance cover a dermatologist visit in Egypt?",
    "answer": "Most private Egyptian health insurance policies cover outpatient dermatologist visits up to the annual outpatient limit of the policy. HAYAI checks your exact remaining limit for a specific policy in under two minutes, before you book, so you know what you will pay at the clinic and which documents the insurer needs.",
    "word_count": 52
  }
}
```

### `feature_grid` — Feature grid

Cards in a grid, each with title, description, icon or image and an optional link.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `columns` | integer: `2` \| `3` \| `4` | yes |  |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `title` | string (plain text) | no |  |
| `description` | string (plain text) | yes |  |
| `icon` | string (plain text) | yes |  |
| `media_id` | integer (media id — use the resolved object below) | yes |  |
| `link` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `image` ✱ | **Image** | yes | resolved `media_id` |

Example:

```json
{
  "id": 4,
  "type": "feature_grid",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "What you get",
    "intro": "Everything a partner hospital needs.",
    "columns": 3,
    "items": [
      {
        "title": "Live ICU listing",
        "description": "Beds update in real time.",
        "icon": "bed",
        "media_id": 1,
        "link": {
          "id": null,
          "key": null,
          "type": "inline",
          "label": "Learn more",
          "sublabel": null,
          "style": "link",
          "icon": null,
          "placement": null,
          "tracking_key": "section.4.feature_grid.item0",
          "action": { "kind": "link", "href": "/en/icu", "target": "_self", "rel": null, "form_key": null, "product": null }
        },
        "image": {
          "id": 1,
          "kind": "image",
          "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
          "mime_type": "image/jpeg",
          "width": 1600,
          "height": 900,
          "alt": "ICU team reviewing live bed availability on HAYAI",
          "caption": "Cairo General Hospital ICU",
          "focal_point": { "x": 50, "y": 40 },
          "variants": [
            { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
          ],
          "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
        }
      },
      { "title": "Insurance checks", "description": "Coverage verified before arrival.", "icon": "shield", "media_id": null, "link": null, "image": null }
    ]
  }
}
```

### `feature_list` — Feature list

A vertical list of features.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `title` | string (plain text) | no |  |
| `description` | string (plain text) | yes |  |
| `icon` | string (plain text) | yes |  |

Example:

```json
{
  "id": 5,
  "type": "feature_list",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Included",
    "intro": "In every plan.",
    "items": [
      { "title": "Bed dashboard", "description": "One screen for every unit.", "icon": "dashboard" }
    ]
  }
}
```

### `pricing` — Pricing

Pricing tiers: either the price tiers of a catalog product (product_id, always current) or inline tiers.

Two modes. **Product mode** (`product_id` set): `tiers` are the product's live **Tier**[] and `product` is its summary. **Inline mode**: `tiers` are the editor's own tiers (**InlineTier**, table below) and `product` is `null`.

_Left out of `sections` when:_ no product and no tiers.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `product_id` | integer (id) | yes |  |
| `tiers` | object[] (items below) | no — `[]` when empty |  |
| `product` ✱ | **ProductSummary** | yes | product mode only; `null` with inline tiers |

`tiers[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `name` | string (plain text) | no |  |
| `price` | string (decimal, e.g. `"999.00"`) | yes |  |
| `currency` | string (ISO, default `EGP`) | no |  |
| `billing_period` | string: `one_time` \| `monthly` \| `quarterly` \| `yearly` | yes |  |
| `description` | string (plain text) | yes |  |
| `features` | string[] (plain text) | no — `[]` when empty |  |
| `is_recommended` | boolean | no — default `false` |  |
| `cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `display` ✱ | string | no | ready-to-print price, e.g. `EGP 999 per month` / `Contact us for pricing` |

(In product mode the items are **Tier** objects instead — see shared objects.)

Example (product mode):

```json
{
  "id": 6,
  "type": "pricing",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "ICU plans",
    "intro": "Monthly, cancel any time.",
    "product_id": 1,
    "tiers": [
      {
        "id": 1,
        "name": "Essential",
        "description": "One ICU unit",
        "price": "4500.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 4,500 per month",
        "min_quantity": null,
        "features": ["ICU listing", "Live bed status"],
        "is_recommended": false
      },
      {
        "id": 2,
        "name": "Network",
        "description": "Up to 5 branches",
        "price": "12000.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 12,000 per month",
        "min_quantity": 1,
        "features": ["Everything in Essential", "Branch dashboard"],
        "is_recommended": true
      }
    ],
    "product": {
      "id": 1,
      "type": "service",
      "sku": "ICU-LIVE",
      "name": "ICU live availability",
      "slug": "icu-live-availability",
      "path": "/en/products/icu-live-availability",
      "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
      "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
      "image": {
        "id": 1,
        "kind": "image",
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
        "mime_type": "image/jpeg",
        "width": 1600,
        "height": 900,
        "alt": "ICU team reviewing live bed availability on HAYAI",
        "caption": "Cairo General Hospital ICU",
        "focal_point": { "x": 50, "y": 40 },
        "variants": [
          { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
        ],
        "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
      },
      "category": { "id": 1, "kind": "product", "name": "Hospital solutions", "slug": "hospital-solutions", "description": "Tools for partner hospitals.", "parent_id": null },
      "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
      "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
      "is_featured": true,
      "is_purchasable": true,
      "quantity": { "min": 1, "max": 50 }
    }
  }
}
```

Example (inline tiers):

```json
{
  "id": 7,
  "type": "pricing",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Simple pricing",
    "intro": "Inline tiers.",
    "product_id": null,
    "tiers": [
      {
        "name": "Starter",
        "price": "999.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "description": "For clinics.",
        "features": ["1 branch", "Email support"],
        "is_recommended": false,
        "cta": {
          "id": null,
          "key": null,
          "type": "inline",
          "label": "Start",
          "sublabel": null,
          "style": "primary",
          "icon": null,
          "placement": null,
          "tracking_key": "section.7.pricing.tier0",
          "action": { "kind": "link", "href": "/en/contact", "target": "_self", "rel": null, "form_key": null, "product": null }
        },
        "display": "EGP 999 per month"
      },
      {
        "name": "Enterprise",
        "price": null,
        "currency": "EGP",
        "billing_period": null,
        "description": "Hospital groups.",
        "features": ["Unlimited branches"],
        "is_recommended": true,
        "cta": null,
        "display": "Contact us for pricing"
      }
    ],
    "product": null
  }
}
```

### `product_grid` — Product grid

Catalog products by explicit selection, by category, or the featured ones. Prices and availability are always live.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `columns` | integer: `2` \| `3` \| `4` | yes |  |
| `product_ids` | integer[] (ids) | no — `[]` when empty |  |
| `category_id` | integer (id) | yes |  |
| `limit` | integer | no — default `6` |  |
| `show_price` | boolean | no — default `true` |  |
| `products` ✱ | **ProductSummary**[] | no | live, in `product_ids` order (else category / featured) |

Example:

```json
{
  "id": 8,
  "type": "product_grid",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Our solutions",
    "intro": "Pick what fits.",
    "columns": 3,
    "product_ids": [1],
    "category_id": null,
    "limit": 6,
    "show_price": true,
    "products": [
      {
        "id": 1,
        "type": "service",
        "sku": "ICU-LIVE",
        "name": "ICU live availability",
        "slug": "icu-live-availability",
        "path": "/en/products/icu-live-availability",
        "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
        "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
        "image": {
          "id": 1,
          "kind": "image",
          "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
          "mime_type": "image/jpeg",
          "width": 1600,
          "height": 900,
          "alt": "ICU team reviewing live bed availability on HAYAI",
          "caption": "Cairo General Hospital ICU",
          "focal_point": { "x": 50, "y": 40 },
          "variants": [
            { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
          ],
          "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
        },
        "category": { "id": 1, "kind": "product", "name": "Hospital solutions", "slug": "hospital-solutions", "description": "Tools for partner hospitals.", "parent_id": null },
        "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
        "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
        "is_featured": true,
        "is_purchasable": true,
        "quantity": { "min": 1, "max": 50 }
      }
    ]
  }
}
```

### `product_card` — Product card

One product with its live price, availability and purchase CTA. layout=buy_box renders the purchase action next to the product information.

_Left out of `sections` when:_ product unpublished / not in this language.

| field | type | can be null? | notes |
|---|---|---|---|
| `product_id` | integer (id) | no |  |
| `layout` | string: `card` \| `horizontal` \| `buy_box` | yes |  |
| `show_price` | boolean | no — default `true` |  |
| `product` ✱ | **ProductSummary** | no |  |
| `tiers` ✱ | **Tier**[] | no | the product's active tiers |
| `ctas` ✱ | **CtaGroups** | no | CTAs attached to the product, by placement |
| `purchase` ✱ | **PurchaseBox** | no |  |

Example:

```json
{
  "id": 9,
  "type": "product_card",
  "anchor": null,
  "settings": null,
  "data": {
    "product_id": 1,
    "layout": "buy_box",
    "show_price": true,
    "product": {
      "id": 1,
      "type": "service",
      "sku": "ICU-LIVE",
      "name": "ICU live availability",
      "slug": "icu-live-availability",
      "path": "/en/products/icu-live-availability",
      "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
      "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
      "image": {
        "id": 1,
        "kind": "image",
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
        "mime_type": "image/jpeg",
        "width": 1600,
        "height": 900,
        "alt": "ICU team reviewing live bed availability on HAYAI",
        "caption": "Cairo General Hospital ICU",
        "focal_point": { "x": 50, "y": 40 },
        "variants": [
          { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
        ],
        "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
      },
      "category": { "id": 1, "kind": "product", "name": "Hospital solutions", "slug": "hospital-solutions", "description": "Tools for partner hospitals.", "parent_id": null },
      "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
      "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
      "is_featured": true,
      "is_purchasable": true,
      "quantity": { "min": 1, "max": 50 }
    },
    "tiers": [
      {
        "id": 1,
        "name": "Essential",
        "description": "One ICU unit",
        "price": "4500.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 4,500 per month",
        "min_quantity": null,
        "features": ["ICU listing", "Live bed status"],
        "is_recommended": false
      },
      {
        "id": 2,
        "name": "Network",
        "description": "Up to 5 branches",
        "price": "12000.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 12,000 per month",
        "min_quantity": 1,
        "features": ["Everything in Essential", "Branch dashboard"],
        "is_recommended": true
      }
    ],
    "ctas": {
      "sidebar": [
        {
          "id": 2,
          "key": "buy-icu-live",
          "type": "purchase",
          "label": "Get ICU live",
          "sublabel": null,
          "style": "primary",
          "icon": "cart",
          "placement": "sidebar",
          "tracking_key": "cta.buy-icu-live",
          "action": {
            "kind": "purchase",
            "href": "/en/products/icu-live-availability",
            "target": "_self",
            "rel": null,
            "form_key": null,
            "product": { "id": 1, "slug": "icu-live-availability", "path": "/en/products/icu-live-availability" }
          }
        }
      ],
      "sticky_mobile": [
        {
          "id": 3,
          "key": "whatsapp-sales",
          "type": "whatsapp",
          "label": "WhatsApp sales",
          "sublabel": null,
          "style": "secondary",
          "icon": "whatsapp",
          "placement": "sticky_mobile",
          "tracking_key": "cta.whatsapp-sales",
          "action": { "kind": "whatsapp", "href": "https://wa.me/201000000000?text=Hello%20HAYAI", "target": "_blank", "rel": "noopener noreferrer", "form_key": null, "product": null }
        }
      ]
    },
    "purchase": {
      "enabled": true,
      "endpoint": "/api/v1/public/en/purchases",
      "product_id": 1,
      "min_quantity": 1,
      "max_quantity": 50,
      "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
      "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
      "fallback_form_key": "purchase-inquiry"
    }
  }
}
```

### `comparison_table` — Comparison table

A real <table>: columns, and rows of cells (text or true/false for check marks).

`rows[].cells` has exactly one cell per entry in `columns`, same order. `true` = ✓, `false` = ✗, `null` = empty, string = text.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `caption` | string (plain text) | no | max 300 chars |
| `columns` | object[] (items below) | no |  |
| `rows` | object[] (items below) | no |  |
| `highlight_column` | string (plain text) | yes | max 40 chars |

`columns[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `key` | string (plain text) | no |  |
| `label` | string (plain text) | no |  |

`rows[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `label` | string (plain text) | no |  |
| `cells` | (string \| boolean \| null)[] | no |  |

Example:

```json
{
  "id": 10,
  "type": "comparison_table",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "HAYAI vs calling around",
    "caption": "Finding an ICU bed",
    "columns": [
      { "key": "hayai", "label": "HAYAI" },
      { "key": "phone", "label": "Phone calls" }
    ],
    "rows": [
      {
        "label": "Live bed status",
        "cells": [true, false]
      },
      {
        "label": "Time to answer",
        "cells": ["Seconds", "Hours"]
      },
      {
        "label": "Insurance check",
        "cells": [true, null]
      }
    ],
    "highlight_column": "hayai"
  }
}
```

### `table` — Table

A generic data table (headers + rows of text cells). Rendered as real <table> markup.

Every row has exactly one cell per header.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `caption` | string (plain text) | no | max 300 chars |
| `headers` | string[] (plain text) | no |  |
| `rows` | (string \| null)[][] | no |  |

Example:

```json
{
  "id": 11,
  "type": "table",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Plan limits",
    "caption": "Limits per plan",
    "headers": ["Plan", "Branches", "Price"],
    "rows": [
      ["Essential", "1", "EGP 4,500"],
      ["Network", "5", "EGP 12,000"]
    ]
  }
}
```

### `faq` — FAQ

Questions and answers. source: attached (FAQs attached to this page), global, selected (faq_ids) or group (group_key). Feeds FAQPage JSON-LD.

_Left out of `sections` when:_ no FAQs to show.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `source` | string: `attached` \| `global` \| `selected` \| `group` | no — default `"attached"` |  |
| `faq_ids` | integer[] (ids) | no — `[]` when empty |  |
| `group_key` | string (plain text) | yes | max 64 chars |
| `limit` | integer | no — default `50` |  |
| `include_in_schema` | boolean | no — default `true` |  |
| `items` ✱ | **Faq**[] | no | never empty (the block is dropped instead) |

Example:

```json
{
  "id": 12,
  "type": "faq",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Questions",
    "source": "global",
    "faq_ids": [],
    "group_key": null,
    "limit": 10,
    "include_in_schema": true,
    "items": [
      { "id": 1, "question": "How long does onboarding take?", "answer": "<p>Most hospitals go live in <strong>48 hours</strong>.</p>", "group_key": "onboarding" }
    ]
  }
}
```

### `cta` — Call to action

A CTA banner / card with heading and text.

_Left out of `sections` when:_ its `cta` is disabled / deleted.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `text` | string (plain text) | yes | max 600 chars |
| `cta` | **Cta** (resolved) | no | replaced in place by the resolved CTA |
| `secondary_cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `variant` | string: `banner` \| `inline` \| `card` | yes |  |

Example:

```json
{
  "id": 13,
  "type": "cta",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Talk to sales",
    "text": "We reply within one working day.",
    "cta": {
      "id": 3,
      "key": "whatsapp-sales",
      "type": "whatsapp",
      "label": "WhatsApp sales",
      "sublabel": null,
      "style": "secondary",
      "icon": "whatsapp",
      "placement": "sticky_mobile",
      "tracking_key": "cta.whatsapp-sales",
      "action": { "kind": "whatsapp", "href": "https://wa.me/201000000000?text=Hello%20HAYAI", "target": "_blank", "rel": "noopener noreferrer", "form_key": null, "product": null }
    },
    "secondary_cta": {
      "id": null,
      "key": null,
      "type": "inline",
      "label": "Email us",
      "sublabel": null,
      "style": "secondary",
      "icon": null,
      "placement": null,
      "tracking_key": "section.13.cta.secondary",
      "action": { "kind": "link", "href": "mailto:sales@hayaihealthcare.com", "target": "_self", "rel": null, "form_key": null, "product": null }
    },
    "variant": "banner"
  }
}
```

### `contact_form` — Contact form

Embeds a form-builder form (its full field definition is included in the page payload).

_Left out of `sections` when:_ form missing or inactive.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `form_key` | string (form key) | no |  |
| `form` ✱ | **Form** | no |  |

Example:

```json
{
  "id": 14,
  "type": "contact_form",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Contact us",
    "intro": "Tell us about your hospital.",
    "form_key": "contact",
    "form": {
      "key": "contact",
      "type": "contact",
      "name": "Contact us",
      "description": null,
      "submit_label": "Send",
      "success_message": "Thank you. Our team will get back to you shortly.",
      "requires_consent": true,
      "consent_text": "I agree that HAYAI may store these details and contact me about this request, as described in the privacy policy.",
      "privacy_url": null,
      "honeypot_field": "website",
      "submit_endpoint": "/api/v1/public/en/forms/contact/submissions",
      "fields": [
        {
          "key": "name",
          "type": "text",
          "label": "Full name",
          "placeholder": null,
          "help": null,
          "required": true,
          "validation": { "max_length": 191 },
          "visibility": null,
          "options": [],
          "accept": null,
          "max_kb": null,
          "max_files": null
        },
        {
          "key": "email",
          "type": "email",
          "label": "Work email",
          "placeholder": null,
          "help": null,
          "required": true,
          "validation": { "max_length": 255 },
          "visibility": null,
          "options": [],
          "accept": null,
          "max_kb": null,
          "max_files": null
        }
      ]
    }
  }
}
```

### `purchase_cta` — Purchase CTA

Buy box for one product: live price, availability, quantity limits and the purchase action.

_Left out of `sections` when:_ product unpublished / not in this language.

| field | type | can be null? | notes |
|---|---|---|---|
| `product_id` | integer (id) | no |  |
| `heading` | string (plain text) | yes | max 200 chars |
| `text` | string (plain text) | yes | max 600 chars |
| `cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `show_price` | boolean | no — default `true` |  |
| `layout` | string: `buy_box` \| `banner` | yes |  |
| `product` ✱ | **ProductSummary** | no |  |
| `tiers` ✱ | **Tier**[] | no |  |
| `ctas` ✱ | **CtaGroups** | no |  |
| `purchase` ✱ | **PurchaseBox** | no |  |

Example:

```json
{
  "id": 15,
  "type": "purchase_cta",
  "anchor": null,
  "settings": null,
  "data": {
    "product_id": 1,
    "heading": "Start today",
    "text": "Live within 48 hours.",
    "cta": {
      "id": 2,
      "key": "buy-icu-live",
      "type": "purchase",
      "label": "Get ICU live",
      "sublabel": null,
      "style": "primary",
      "icon": "cart",
      "placement": "sidebar",
      "tracking_key": "cta.buy-icu-live",
      "action": {
        "kind": "purchase",
        "href": "/en/products/icu-live-availability",
        "target": "_self",
        "rel": null,
        "form_key": null,
        "product": { "id": 1, "slug": "icu-live-availability", "path": "/en/products/icu-live-availability" }
      }
    },
    "show_price": true,
    "layout": "buy_box",
    "product": {
      "id": 1,
      "type": "service",
      "sku": "ICU-LIVE",
      "name": "ICU live availability",
      "slug": "icu-live-availability",
      "path": "/en/products/icu-live-availability",
      "url": "https://hayaihealthcare.com/en/products/icu-live-availability",
      "short_description": "Publish your ICU beds in real time to insured patients and referring doctors.",
      "image": {
        "id": 1,
        "kind": "image",
        "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
        "mime_type": "image/jpeg",
        "width": 1600,
        "height": 900,
        "alt": "ICU team reviewing live bed availability on HAYAI",
        "caption": "Cairo General Hospital ICU",
        "focal_point": { "x": 50, "y": 40 },
        "variants": [
          { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
        ],
        "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
      },
      "category": { "id": 1, "kind": "product", "name": "Hospital solutions", "slug": "hospital-solutions", "description": "Tools for partner hospitals.", "parent_id": null },
      "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
      "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
      "is_featured": true,
      "is_purchasable": true,
      "quantity": { "min": 1, "max": 50 }
    },
    "tiers": [
      {
        "id": 1,
        "name": "Essential",
        "description": "One ICU unit",
        "price": "4500.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 4,500 per month",
        "min_quantity": null,
        "features": ["ICU listing", "Live bed status"],
        "is_recommended": false
      },
      {
        "id": 2,
        "name": "Network",
        "description": "Up to 5 branches",
        "price": "12000.00",
        "currency": "EGP",
        "billing_period": "monthly",
        "display": "EGP 12,000 per month",
        "min_quantity": 1,
        "features": ["Everything in Essential", "Branch dashboard"],
        "is_recommended": true
      }
    ],
    "ctas": {
      "sidebar": [
        {
          "id": 2,
          "key": "buy-icu-live",
          "type": "purchase",
          "label": "Get ICU live",
          "sublabel": null,
          "style": "primary",
          "icon": "cart",
          "placement": "sidebar",
          "tracking_key": "cta.buy-icu-live",
          "action": {
            "kind": "purchase",
            "href": "/en/products/icu-live-availability",
            "target": "_self",
            "rel": null,
            "form_key": null,
            "product": { "id": 1, "slug": "icu-live-availability", "path": "/en/products/icu-live-availability" }
          }
        }
      ],
      "sticky_mobile": [
        {
          "id": 3,
          "key": "whatsapp-sales",
          "type": "whatsapp",
          "label": "WhatsApp sales",
          "sublabel": null,
          "style": "secondary",
          "icon": "whatsapp",
          "placement": "sticky_mobile",
          "tracking_key": "cta.whatsapp-sales",
          "action": { "kind": "whatsapp", "href": "https://wa.me/201000000000?text=Hello%20HAYAI", "target": "_blank", "rel": "noopener noreferrer", "form_key": null, "product": null }
        }
      ]
    },
    "purchase": {
      "enabled": true,
      "endpoint": "/api/v1/public/en/purchases",
      "product_id": 1,
      "min_quantity": 1,
      "max_quantity": 50,
      "pricing": { "type": "fixed", "price": "4500.00", "compare_at_price": "5000.00", "currency": "EGP", "billing_period": "monthly", "display": "EGP 4,500 per month" },
      "availability": { "status": "available", "label": "Available", "schema_org": "https://schema.org/InStock" },
      "fallback_form_key": "purchase-inquiry"
    }
  }
}
```

### `hospital_partner_cta` — Hospital partner CTA

Partnership pitch with benefits and the partnership form (default: hospital-partnership).

`form_key` is never null (default `hospital-partnership`).

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | no | max 200 chars |
| `text` | string (plain text) | yes | max 1000 chars |
| `benefits` | string[] (plain text) | no — `[]` when empty |  |
| `form_key` | string (form key) | no — default `"hospital-partnership"` |  |
| `cta` | **Cta** (resolved) | yes | replaced in place by the resolved CTA |
| `media_id` | integer (media id — use the resolved object below) | yes |  |
| `form` ✱ | **Form** | yes | null if that form is inactive |
| `image` ✱ | **Image** | yes | resolved `media_id` |

Example:

```json
{
  "id": 16,
  "type": "hospital_partner_cta",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Become a partner hospital",
    "text": "Join the HAYAI network.",
    "benefits": ["More insured patients", "Faster approvals"],
    "form_key": "hospital-partnership",
    "cta": {
      "id": null,
      "key": null,
      "type": "inline",
      "label": "See partner terms",
      "sublabel": null,
      "style": "secondary",
      "icon": null,
      "placement": null,
      "tracking_key": "section.16.hospital_partner_cta.primary",
      "action": { "kind": "link", "href": "/en/partners/terms", "target": "_self", "rel": null, "form_key": null, "product": null }
    },
    "media_id": 1,
    "form": {
      "key": "hospital-partnership",
      "type": "hospital_partnership",
      "name": "Partner with HAYAI",
      "description": null,
      "submit_label": "Send",
      "success_message": "Thank you. Our partnerships team will contact you within two working days.",
      "requires_consent": true,
      "consent_text": "I agree that HAYAI may store these details and contact me about this request, as described in the privacy policy.",
      "privacy_url": null,
      "honeypot_field": "website",
      "submit_endpoint": "/api/v1/public/en/forms/hospital-partnership/submissions",
      "fields": [
        {
          "key": "name",
          "type": "text",
          "label": "Full name",
          "placeholder": null,
          "help": null,
          "required": true,
          "validation": { "max_length": 191 },
          "visibility": null,
          "options": [],
          "accept": null,
          "max_kb": null,
          "max_files": null
        },
        {
          "key": "job_title",
          "type": "text",
          "label": "Job title",
          "placeholder": null,
          "help": null,
          "required": false,
          "validation": { "max_length": 191 },
          "visibility": null,
          "options": [],
          "accept": null,
          "max_kb": null,
          "max_files": null
        }
      ]
    },
    "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": { "x": 50, "y": 40 },
      "variants": [
        { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    }
  }
}
```

### `testimonial` — Testimonials

Quotes from real customers. Never emitted as Review / AggregateRating schema.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `quote` | string (plain text) | no |  |
| `author_name` | string (plain text) | no |  |
| `author_title` | string (plain text) | yes |  |
| `organization` | string (plain text) | yes |  |
| `media_id` | integer (media id — use the resolved object below) | yes |  |
| `image` ✱ | **Image** | yes | resolved `media_id` (person photo) |

Example:

```json
{
  "id": 17,
  "type": "testimonial",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "What partners say",
    "items": [
      {
        "quote": "Our ICU occupancy went up within a month.",
        "author_name": "Dr. Samir Fathy",
        "author_title": "Medical director",
        "organization": "Nile Hospital",
        "media_id": 3,
        "image": {
          "id": 3,
          "kind": "image",
          "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6.jpg",
          "mime_type": "image/jpeg",
          "width": 400,
          "height": 400,
          "alt": "Dr. Hala Mostafa",
          "caption": null,
          "focal_point": { "x": 50, "y": 40 },
          "variants": [
            { "width": 400, "height": 400, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp", "mime_type": "image/webp" }
          ],
          "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp 400w"
        }
      }
    ]
  }
}
```

### `statistic` — Statistics

Figures with labels; add a source_url for any claim.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `value` | string (plain text) | no |  |
| `label` | string (plain text) | no |  |
| `description` | string (plain text) | yes |  |
| `source_url` | string (URL / site path / `#anchor` / `mailto:` / `tel:`) | yes |  |

Example:

```json
{
  "id": 18,
  "type": "statistic",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "In numbers",
    "items": [
      { "value": "120+", "label": "Partner hospitals", "description": "Across 14 governorates.", "source_url": "https://example.org/report" }
    ]
  }
}
```

### `image` — Image

One library image (responsive srcset, explicit dimensions and alt text come from the media library).

_Left out of `sections` when:_ image deleted.

| field | type | can be null? | notes |
|---|---|---|---|
| `media_id` | integer (media id — use the resolved object below) | no |  |
| `caption` | string (plain text) | yes | max 500 chars |
| `link_url` | string (URL / site path / `#anchor` / `mailto:` / `tel:`) | yes |  |
| `size` | string: `content` \| `wide` \| `full` | yes |  |
| `image` ✱ | **Image** | no | resolved `media_id` |

Example:

```json
{
  "id": 19,
  "type": "image",
  "anchor": null,
  "settings": null,
  "data": {
    "media_id": 1,
    "caption": "Our Cairo operations room",
    "link_url": "/en/about",
    "size": "wide",
    "image": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": { "x": 50, "y": 40 },
      "variants": [
        { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    }
  }
}
```

### `video` — Video

YouTube / Vimeo URL or a self-hosted library video. A transcript makes the content retrievable by answer engines.

For `youtube` / `vimeo`, render an iframe with `embed_url`. For `self`, render `<video>` with `video.url` and `poster`.

_Left out of `sections` when:_ `self` video whose file was deleted.

| field | type | can be null? | notes |
|---|---|---|---|
| `title` | string (plain text) | no | max 200 chars |
| `provider` | string: `youtube` \| `vimeo` \| `self` | no |  |
| `url` | string (URL / site path / `#anchor` / `mailto:` / `tel:`) | yes |  |
| `media_id` | integer (media id — use the resolved object below) | yes |  |
| `poster_media_id` | integer (media id — use the resolved object below) | yes |  |
| `description` | string (plain text) | yes | max 1000 chars |
| `transcript` | string (plain text) | yes | max 20000 chars |
| `duration_seconds` | integer | yes |  |
| `poster` ✱ | **Image** | yes | resolved `poster_media_id` |
| `video` ✱ | **Image** (with `kind: "video"`) | yes | only for `provider: self` |
| `embed_url` ✱ | string | yes | youtube-nocookie / player.vimeo iframe URL — use this, not `url` |

Example:

```json
{
  "id": 20,
  "type": "video",
  "anchor": null,
  "settings": null,
  "data": {
    "title": "HAYAI in two minutes",
    "provider": "youtube",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "media_id": null,
    "poster_media_id": 1,
    "description": "A short product tour.",
    "transcript": "Welcome to HAYAI...",
    "duration_seconds": 120,
    "poster": {
      "id": 1,
      "kind": "image",
      "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
      "mime_type": "image/jpeg",
      "width": 1600,
      "height": 900,
      "alt": "ICU team reviewing live bed availability on HAYAI",
      "caption": "Cairo General Hospital ICU",
      "focal_point": { "x": 50, "y": 40 },
      "variants": [
        { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
      ],
      "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
    },
    "video": null,
    "embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  }
}
```

### `logo_grid` — Logo grid

Partner / insurer logos.

_Left out of `sections` when:_ no logo left.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `media_id` | integer (media id — use the resolved object below) | no |  |
| `name` | string (plain text) | no |  |
| `url` | string (URL / site path / `#anchor` / `mailto:` / `tel:`) | yes |  |
| `image` ✱ | **Image** | no | items whose image was deleted are removed |

Example:

```json
{
  "id": 21,
  "type": "logo_grid",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Insurers we work with",
    "items": [
      {
        "media_id": 2,
        "name": "Allianz Egypt",
        "url": "https://www.allianz.com.eg",
        "image": {
          "id": 2,
          "kind": "image",
          "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433.png",
          "mime_type": "image/png",
          "width": 400,
          "height": 200,
          "alt": "Allianz Egypt logo",
          "caption": null,
          "focal_point": { "x": 50, "y": 40 },
          "variants": [
            { "width": 400, "height": 200, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433-400.webp", "mime_type": "image/webp" }
          ],
          "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/affa4433-400.webp 400w"
        }
      }
    ]
  }
}
```

### `steps` — Steps

An ordered how-it-works list (rendered as <ol>).

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `title` | string (plain text) | no |  |
| `description` | string (plain text) | yes |  |

Example:

```json
{
  "id": 22,
  "type": "steps",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "How it works",
    "intro": "Three steps.",
    "items": [
      { "title": "Sign the agreement", "description": "Online, in minutes." },
      { "title": "Go live", "description": "We set up your units." }
    ]
  }
}
```

### `benefits` — Benefits

Benefit statements with optional icons.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `intro` | string (plain text) | yes | max 1000 chars |
| `items` | object[] (items below) | no |  |

`items[]` item:

| field | type | can be null? | notes |
|---|---|---|---|
| `title` | string (plain text) | no |  |
| `description` | string (plain text) | yes |  |
| `icon` | string (plain text) | yes |  |

Example:

```json
{
  "id": 23,
  "type": "benefits",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Benefits",
    "intro": "For your team.",
    "items": [
      { "title": "Less admin", "description": "Insurance is pre-checked.", "icon": "clock" }
    ]
  }
}
```

### `article_list` — Article list

Published articles: latest, featured, by category, by author, or selected.

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `source` | string: `latest` \| `featured` \| `category` \| `author` \| `selected` | no — default `"latest"` |  |
| `category_id` | integer (id) | yes |  |
| `author_id` | integer (id) | yes |  |
| `page_ids` | integer[] (ids) | no — `[]` when empty |  |
| `limit` | integer | no — default `6` |  |
| `articles` ✱ | **Article**[] | no | newest first; the current page is excluded |

Example:

```json
{
  "id": 24,
  "type": "article_list",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "From the blog",
    "source": "latest",
    "category_id": null,
    "author_id": null,
    "page_ids": [],
    "limit": 3,
    "articles": [
      {
        "id": 2,
        "type": "article",
        "title": "Does my insurance cover a dermatologist visit in Egypt?",
        "excerpt": "How outpatient limits work for skin-care visits.",
        "path": "/en/blog/insurance-dermatologist",
        "url": "https://hayaihealthcare.com/en/blog/insurance-dermatologist",
        "image": {
          "id": 1,
          "kind": "image",
          "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9.jpg",
          "mime_type": "image/jpeg",
          "width": 1600,
          "height": 900,
          "alt": "ICU team reviewing live bed availability on HAYAI",
          "caption": "Cairo General Hospital ICU",
          "focal_point": { "x": 50, "y": 40 },
          "variants": [
            { "width": 400, "height": 225, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp", "mime_type": "image/webp" }
          ],
          "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/b7e575f9-400.webp 400w"
        },
        "author": {
          "id": 1,
          "slug": "dr-hala-mostafa",
          "name": "Dr. Hala Mostafa",
          "job_title": "Medical advisor",
          "credentials": "MBBS, MSc Health Economics",
          "bio": null,
          "photo": {
            "id": 3,
            "kind": "image",
            "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6.jpg",
            "mime_type": "image/jpeg",
            "width": 400,
            "height": 400,
            "alt": "Dr. Hala Mostafa",
            "caption": null,
            "focal_point": { "x": 50, "y": 40 },
            "variants": [
              { "width": 400, "height": 400, "url": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp", "mime_type": "image/webp" }
            ],
            "srcset": "https://api.hayaihealthcare.com/storage/website/media/2026/10/7a3969a6-400.webp 400w"
          },
          "same_as": ["https://www.linkedin.com/in/hala-example"],
          "url": "https://hayaihealthcare.com/en/authors/dr-hala-mostafa",
          "path": "/en/authors/dr-hala-mostafa"
        },
        "category": { "id": 2, "kind": "article", "name": "Insurance guides", "slug": "insurance-guides", "description": null, "parent_id": null },
        "tags": ["insurance", "dermatology"],
        "reading_time_minutes": 1,
        "is_featured": false,
        "published_at": "2026-10-03T20:11:06+00:00",
        "modified_at": "2026-10-03T20:11:06+00:00"
      }
    ]
  }
}
```

### `doctor_list` — Doctor list

Approved doctors from the HAYAI directory (empty unless directory.doctors_public is on).

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `specialty` | string (plain text) | yes | max 100 chars |
| `limit` | integer | no — default `6` |  |
| `available` ✱ | boolean | no | false while the doctor directory is private |
| `doctors` ✱ | **Doctor**[] | no | `[]` while private |

Example:

```json
{
  "id": 25,
  "type": "doctor_list",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Our dermatologists",
    "specialty": "dermatology",
    "limit": 6,
    "available": true,
    "doctors": [
      {
        "entity": "doctor",
        "id": 1,
        "slug": "dr-amina-saleh",
        "name": "Dr. Amina Saleh",
        "image": null,
        "specialty": { "name": "Dermatology", "slug": "dermatology" },
        "subspecialty": null,
        "job_title": "Consultant dermatologist",
        "years_of_experience": 12,
        "location": null,
        "is_verified": false,
        "rating": null,
        "path": "/en/doctors/dermatology/dr-amina-saleh",
        "url": "https://hayaihealthcare.com/en/doctors/dermatology/dr-amina-saleh",
        "url_path": "doctors/dermatology/dr-amina-saleh"
      }
    ]
  }
}
```

### `hospital_list` — Hospital list

Verified partner hospitals from the HAYAI directory (empty unless directory.hospitals_public is on).

| field | type | can be null? | notes |
|---|---|---|---|
| `heading` | string (plain text) | yes | max 200 chars |
| `icu_only` | boolean | no — default `false` |  |
| `limit` | integer | no — default `6` |  |
| `available` ✱ | boolean | no | false while the hospital directory is private |
| `hospitals` ✱ | **Hospital**[] | no | `[]` while private |

Example:

```json
{
  "id": 26,
  "type": "hospital_list",
  "anchor": null,
  "settings": null,
  "data": {
    "heading": "Partner hospitals",
    "icu_only": true,
    "limit": 6,
    "available": true,
    "hospitals": []
  }
}
```

### `custom_link` — Link

A single link with optional description.

`target` is always filled: `_blank` for external URLs, else `_self`, unless the editor chose one.

| field | type | can be null? | notes |
|---|---|---|---|
| `label` | string (plain text) | no | max 120 chars |
| `url` | string (URL / site path / `#anchor` / `mailto:` / `tel:`) | no |  |
| `description` | string (plain text) | yes | max 300 chars |
| `target` | string: `_self` \| `_blank` | no |  |
| `rel` ✱ | string | yes | `noopener noreferrer` for external / `_blank` |

Example:

```json
{
  "id": 27,
  "type": "custom_link",
  "anchor": null,
  "settings": null,
  "data": { "label": "Read the partner guide", "url": "https://docs.example.org/partner-guide", "description": "PDF, 12 pages.", "target": "_blank", "rel": "noopener noreferrer" }
}
```

### `breadcrumbs` — Breadcrumbs

Renders the page breadcrumbs (computed by the backend) at this position.

No editable fields.

| field | type | can be null? | notes |
|---|---|---|---|
| `items` ✱ | **Breadcrumb**[] | no | same list as the page `breadcrumbs` |

Example:

```json
{
  "id": 28,
  "type": "breadcrumbs",
  "anchor": null,
  "settings": null,
  "data": {
    "items": [
      { "name": "Home", "url": "https://hayaihealthcare.com/en", "path": "/en" },
      { "name": "Partner with HAYAI", "url": "https://hayaihealthcare.com/en/partner-with-hayai", "path": "/en/partner-with-hayai" }
    ]
  }
}
```
