# HAYAI — Tag Manager container setup (GTM-5VKC5CMT)

The exact configuration of the container, built on what the site pushes today.
The container lives on Dr. Jannah's account (marketing holds Publish; every change goes through her). This file is what we hand them so the container matches
what the site pushes. It also serves as the audit list during the joint Preview test.

IDs from the marketing team's reply of 7 Oct 2026:

| What | ID |
|---|---|
| Container | `GTM-5VKC5CMT` (ignore `GTM-MQXV4TCD`, created by mistake) |
| GA4 — live (HAYAI Website) | `G-NS1Q07ZLBF` |
| GA4 — staging (HAYAI Staging) | `G-EXCKD07VXC` |
| Google Ads account | `322-939-8343` |
| Google Ads conversion ID | `AW-18499939113` |
| Clarity project | `yu39huk43j` |
| CookieYes website key | `aa524032afac8db9c6d93f8b2c688ffb` |

## 0. Server environment (production)

```
GTM_ID=GTM-5VKC5CMT
CONSENT_COOKIE=cookieyes-consent
CONSENT_GRANTED_PATTERN=advertisement:yes
```

- **Do not set `GTM_ENV_PARAMS` on production.** It carries the staging
  `gtm_auth`/`gtm_preview` and belongs only on a staging server, which does not
  exist yet (see section 6).
- Verify `CONSENT_GRANTED_PATTERN` against the real cookie once the banner is
  live: accept all → DevTools → Application → Cookies → `cookieyes-consent`
  should contain `advertisement:yes`. Reject all → `advertisement:no`.

## 1. What the site pushes (do not change names in the container)

Rendered by the server **before** the container loads, on every `/ar` `/en` page:

| Key | Values |
|---|---|
| `page_type` | `home`, `page`, `landing`, `article`, `product`, `doctor_profile`, `hospital_profile`, `<kind>_listing`, `search_results`, `order_tracking`, `not_found` |
| `page_language` | `ar` / `en` |
| `page_sensitivity` | `standard` / `sensitive` (unknown = sensitive) |
| `content_group`, `journey_stage` | from the CMS |
| `care_category` | from the CMS when sent; else `hospital` / `insurance` / `emergency` / `doctor` from `content_group`; else null |
| `clarity_allowed` | `true` only on a standard CMS page (home, coverage, how it works, FAQ, about); `false` on products, doctor/hospital pages, listings/search, order tracking, sensitive pages |
| `traffic_type` | `internal` for the team (`?hayai_team=1`) |
| `ft_source`, `ft_medium`, `ft_campaign` | first touch, after consent |
| `gtm.blocklist` | `['customScripts']` — Custom HTML / Custom JS cannot run |

Events pushed by the app (only after the server confirmed the action):

| Event | Parameters |
|---|---|
| `virtual_page_view` | full metadata above + `page_location`, `page_title` |
| `generate_lead` | `transaction_id`, `event_id` (same value), `form_id` (`form_key` too, same value), `lead_type`, `care_category` |
| `purchase_submitted` | `transaction_id`, `event_id`, `value`, `currency: EGP` (hospital purchase request) |
| `cta_click` | `cta_kind`, `cta_tracking_key`, `placement` |
| `search_results_view` | `result_count`, `care_category`, `area` — never the query (search, doctors, hospitals, products) |
| `no_results` | `care_category`, `area` — right after `search_results_view` with 0 |
| `form_error` | `form_id`, `error_type` (`validation` / `server` / `timeout`) — only when the API refused a submit |

Every event also carries the page metadata above. The full plan is `tracking/plan.json`.

WhatsApp and phone are **not** pushed by the app; the link-click triggers below
are their only source, so a click can never be counted twice.

## 2. Variables

Built-in: Click URL, Click Element, Page Hostname, Page Path, Event, Container Version.

| Name | Type | Value |
|---|---|---|
| `DLV - page_type`, `DLV - page_language`, `DLV - care_category` | Data Layer Variable v2 | same key |
| `DLV - page_sensitivity` | Data Layer Variable v2 | `page_sensitivity` |
| `DLV - clarity_allowed` | Data Layer Variable v2 | `clarity_allowed` |
| `DLV - traffic_type` | Data Layer Variable v2 | `traffic_type` |
| `DLV - content_group`, `DLV - journey_stage` | Data Layer Variable v2 | same key |
| `DLV - transaction_id`, `DLV - event_id`, `DLV - form_id`, `DLV - lead_type` | Data Layer Variable v2 | same key |
| `DLV - result_count`, `DLV - area`, `DLV - error_type` | Data Layer Variable v2 | same key |
| `DLV - value`, `DLV - currency` | Data Layer Variable v2 | same key |
| `DLV - cta_kind`, `DLV - cta_tracking_key`, `DLV - placement` | Data Layer Variable v2 | same key |
| `DLV - page_location`, `DLV - page_title` | Data Layer Variable v2 | same key |
| `DLV - ft_source`, `DLV - ft_medium`, `DLV - ft_campaign` | Data Layer Variable v2 | same key |
| `LT - GA4 ID by hostname` | Lookup Table on `{{Page Hostname}}` | `hayaihealthcare.com` → `G-NS1Q07ZLBF`; `www.hayaihealthcare.com` → `G-NS1Q07ZLBF`; **default** → `G-EXCKD07VXC` (localhost, any test host) |
| `CONST - Google Ads ID` | Constant | `AW-18499939113` |

## 3. Triggers

| Name | Type and condition |
|---|---|
| `CE - virtual_page_view` | Custom Event `virtual_page_view` |
| `CE - generate_lead` | Custom Event `generate_lead` |
| `CE - purchase_submitted` | Custom Event `purchase_submitted` |
| `CE - cta_click` | Custom Event `cta_click` |
| `CE - search_results_view`, `CE - no_results`, `CE - form_error` | Custom Event, exact name |
| `Click - WhatsApp` | Just Links, **Wait for tags OFF**, Click URL matches RegEx `wa\.me\|api\.whatsapp\.com\|whatsapp://` |
| `Click - Phone` | Just Links, **Wait for tags OFF**, Click URL matches RegEx `^tel:\s*\+?\s*20` (HAYAI's own number; the ambulance `123` never matches) |
| `Click - App store` | Just Links, Wait for tags OFF, Click URL matches RegEx `play\.google\.com\|apps\.apple\.com` |
| `Window Loaded - Clarity allowed` | Window Loaded, `{{DLV - clarity_allowed}}` equals `true` |
| `Block - Sensitive` | Custom Event `.*` (regex), `{{DLV - page_sensitivity}}` equals `sensitive` |
| `Block - Staging` | Custom Event `.*` (regex), `{{Page Hostname}}` does not match RegEx `^(www\.)?hayaihealthcare\.com$` |
| `Block - Internal` | Custom Event `.*` (regex), `{{DLV - traffic_type}}` equals `internal` |

## 4. Tags

Every tag declares its consent (Advanced settings → Consent settings → Require additional consent).

| Tag | Settings | Fires on | Exceptions | Consent |
|---|---|---|---|---|
| `CMP - CookieYes` | Gallery template **CookieYes CMP**, website key `aa524032afac8db9c6d93f8b2c688ffb`, defaults all denied (same as the page) | Consent Initialization - All Pages | — | none (CMP) |
| `Google tag - GA4` | Tag ID `{{LT - GA4 ID by hostname}}`; config params `page_type`, `page_language`, `page_sensitivity`, `content_group`, `journey_stage`, `traffic_type`; user properties `first_source/medium/campaign` ← `DLV ft_*` | Initialization - All Pages | — | analytics_storage |
| `GA4 - page_view (SPA)` | Event `page_view`, `page_location`, `page_title` from DLV | CE - virtual_page_view | — | analytics_storage |
| `GA4 - generate_lead` | params `transaction_id`, `form_id`, `lead_type`, `care_category` | CE - generate_lead | — | analytics_storage |
| `GA4 - purchase_submitted` | params `transaction_id`, `value`, `currency` | CE - purchase_submitted | — | analytics_storage |
| `GA4 - cta_click` | params `cta_kind`, `cta_tracking_key`, `placement` | CE - cta_click | — | analytics_storage |
| `GA4 - search_results_view` / `no_results` / `form_error` | params as in section 1 | the matching CE trigger | — | analytics_storage |
| `GA4 - whatsapp_click` / `phone_click` / `app_download_click` | param `link_url` = Click URL | the matching Click trigger | — | analytics_storage |
| `Conversion Linker` | default | All Pages | — | built-in |
| `GAds - Conv - Lead` | ID `AW-18499939113`, label `8zBYCL-7zZQdEKnWuvVE`, Transaction ID `{{DLV - transaction_id}}`, value empty (set in Ads) | CE - generate_lead | Sensitive, Staging, Internal | ad_storage, ad_user_data |
| `GAds - Conv - WhatsApp` | label `vjE2CMK7zZQdEKnWuvVE`, value empty | Click - WhatsApp | Sensitive, Staging, Internal | ad_storage, ad_user_data |
| `GAds - Conv - Phone` | label `9eobCMW7zZQdEKnWuvVE`, value empty | Click - Phone | Sensitive, Staging, Internal | ad_storage, ad_user_data |
| `Clarity` | Gallery template **Microsoft Clarity**, project `yu39huk43j` | Window Loaded - Clarity allowed | Internal | analytics_storage |

Not created yet:

- **Booking Confirmed** (label `Ap5ZCLy7zZQdEKnWuvVE`): booking happens in the app,
  so the site has no confirmation event. Add the tag when a `booking_complete`
  event with `value` + `currency: 'EGP'` exists.
- **Enhanced conversions**: off by the client's decision; the site sends no
  e-mail or phone, hashed or not.
- **Remarketing**: not requested yet. If added: All Pages + CE - virtual_page_view,
  exceptions Sensitive / Staging / Internal, consent ad_storage + ad_personalization.

## 5. Clarity on in-app navigation

The Clarity tag fires once, on the first page load, only when `clarity_allowed`
is true. When the visitor then moves inside the site to a page where it is
false, the app calls `clarity('stop')` before pushing `virtual_page_view`, so a
recording that started on the home page never continues onto a product,
doctor or ICU page. Forms on allowed pages are covered by `data-clarity-mask`
plus the project's Strict masking.

## 6. Staging and testing

There is no staging server yet. Until there is one:

- Test every change with **Preview** (Tag Assistant) on the live site — preview
  only affects the browser that opened it.
- Any host other than `hayaihealthcare.com` (localhost, a future staging host)
  automatically sends GA4 data to the staging property and never fires Ads tags
  (`LT - GA4 ID by hostname` + `Block - Staging`).
- The GTM “Staging” environment stays unused. Its URL (`/login`) is only the
  preview link GTM shows; the live site never prints `gtm_auth`/`gtm_preview`.
- When a staging host exists: set `GTM_ID` + `GTM_ENV_PARAMS` on that server only.

## 7. Before publishing

1. Preview on `/ar`: Consent Initialization shows CookieYes; before accepting,
   no GA4/Ads/Clarity request leaves the page.
2. Accept all → GA4 page_view; Clarity loads on `/ar`, not on the emergency page
   or a product page.
3. Send the home page form → `generate_lead` + `GAds - Conv - Lead` fire once.
4. Click the WhatsApp button and the footer number → one WhatsApp / Phone
   conversion each; the page is not held (Wait for tags off).
5. Open the emergency page and click WhatsApp → GA4 fires, Ads does not (Block - Sensitive).
6. With `?hayai_team=1` → Ads and Clarity do not fire.
7. Publish with a version name and note; export the container JSON to
   `tracking/gtm/v<N>.json`.
