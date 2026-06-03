# BAREEQ / HAYAI — Full Business & API Analysis

> **Project name in code:** `BAREEQ` (Angular project name in `angular.json`) — UI brand shown is `HAYAI` (logo + navbar).
> **Type:** Admin Dashboard SPA (Angular 20, standalone components, signals, lazy-loaded routes).
> **Audience of this doc:** Backend engineer building the REST API for this dashboard.
> **Date:** 2026-05-24
> **Source repo:** `n:/Codes/Hayai/Hayai`

This document is a **complete component-by-component business analysis** of the Angular dashboard, followed by a **full REST API contract** (endpoints, query params, request bodies, response shapes) that the backend must implement. Every screen, every button, every dropdown, every field shown in the UI is enumerated here. Nothing in the UI is left without an endpoint.

---

## Table of Contents

1. [Business Domain Overview](#1-business-domain-overview)
2. [Roles & Authentication](#2-roles--authentication)
3. [Global Conventions (Pagination / Filtering / Errors / Files)](#3-global-conventions)
4. [Core Domain Entities (Data Models)](#4-core-domain-entities)
5. [Component-by-Component Business Analysis](#5-component-by-component-business-analysis)
   - 5.1 Login
   - 5.2 Dashboard Shell (Navbar / Sidebar)
   - 5.3 Home / Overview Dashboard
   - 5.4 Advertisements
   - 5.5 Charitable Organizations
   - 5.6 Transactions
   - 5.7 Renewal Users
   - 5.8 Plans Management
   - 5.9 Send Notifications
   - 5.10 Users (12 user types)
   - 5.11 Centers (Dialysis / Hyperbaric Oxygen / Oncology)
   - 5.12 External Medical Devices (Devices & Orders) — *menu present, routes not yet implemented*
6. [Complete REST API Endpoint Catalog](#6-complete-rest-api-endpoint-catalog)
7. [Lookup / Reference Data Endpoints](#7-lookup--reference-data-endpoints)
8. [Notes & Open Questions for Backend](#8-notes--open-questions-for-backend)

---

## 1. Business Domain Overview

**HAYAI** is a healthcare / medical-tourism marketplace platform connecting **Patients** and **medical Tourists** with a wide ecosystem of medical providers in Egypt. This repo is the **Admin (manager) Dashboard** used by HAYAI's internal staff to:

- Manage all 12 provider/user types (hospitals, clinics, doctors, pharmacies, labs, home care, physical therapy, medical issuance, employment offices, medical devices) plus Patients and Tourists.
- Manage 3 specialized medical Centers (Dialysis, Hyperbaric Oxygen, Oncology).
- Sell, manage, and renew **subscription plans** (Free / Basic / Premium / Practice / Professional, etc.) — providers subscribe to use the platform.
- Monitor all **transactions / service requests** flowing through the platform (e.g. Home Visit Requests) between providers and patients.
- Publish **Advertisements** (banners) and manage **Charitable Organizations** listings.
- Broadcast **push/in-app notifications** to targeted user segments.
- View aggregate **analytics** (total users, revenue, growth charts).
- Approve/activate new provider sign-ups (driven by the notification panel showing "X is waiting for activation").

The end-user marketplace itself (mobile/web apps for patients) is **out of scope** for this dashboard but is implied to exist — many endpoints below will be shared with that side.

---

## 2. Roles & Authentication

### Role Model
File: [role.type.ts](src/app/core/models/role.type.ts) + [user.model.ts](src/app/core/models/user.model.ts)

```ts
type UserRole = 'admin' | 'manager';

interface UserModel {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
```

- **admin** — full access (currently every menu item has `roles: ['admin']`, see [menu.config.ts](src/app/core/navigation/menu.config.ts)).
- **manager** — defined in the type union but no menu items are gated to manager today; backend should still issue tokens carrying the role.

> The sidebar currently **hard-codes role to `'admin'`** for development. Real filtering will resume once login is wired (`sidebar.component.ts` line 32: `const role = 'admin';`). Backend must return the real role in the JWT/profile so the FE can re-enable role-based menu filtering.

### Auth Service (FE state)
File: [auth.service.ts](src/app/core/services/auth.service.ts) — keeps the current user in an Angular `signal`. Methods: `setUser(user)`, `clearUser()`.

### Guards
- [auth.guard.ts](src/app/core/guards/auth.guard.ts) — `dashboardShellGuard` redirects to `/login` if no `currentUser`. *Currently commented out in routes.*
- [role-match.guard.ts](src/app/core/guards/role-match.guard.ts) — `roleMatchGuard(allowedRoles)` `CanMatch` guard checking `user.role`.

### Login UI
File: [login.component.html](src/app/features/auth/login.component/login.component.html)

Fields shown:
- **Email** (text input, type=email)
- **Password** (text input with show/hide eye toggle)
- **Login button** (submit)
- A "Language" `EN` dropdown in the top-right (i18n placeholder, no functionality yet).
- Right side is just an illustration (`home.png`).

There is **no** "Forgot password", **no** "Remember me", **no** signup link in the login screen. The dashboard is admin-only — providers/patients sign up through the public marketplace, not here.

**Backend must provide:**
- `POST /auth/login` → `{ email, password }` returns `{ accessToken, refreshToken, user: UserModel }`.
- `POST /auth/refresh` → `{ refreshToken }` returns new pair.
- `POST /auth/logout` → invalidates refresh token.
- `GET /auth/me` → returns current `UserModel` for the bearer token.

Token storage: a `TokenService` and `UserService` file exist but are **empty (0 lines)** — backend should still expect Bearer JWT in `Authorization: Bearer <token>`. Interceptor files ([auth.interceptor.ts](src/app/core/interceptors/auth.interceptor.ts), [error.interceptor.ts](src/app/core/interceptors/error.interceptor.ts)) also exist but are empty — will be implemented to attach the token and centralize error handling.

---

## 3. Global Conventions

### 3.1 Pagination
Every table view (Transactions, Renewal, all 12 user types) shows a pagination footer with `Previous | 1 2 3 ... 8 9 10 | Next`, and a header badge like `"100 users"` / `"100 Transactions"`.

**All list endpoints must support:**
- `?page=<int>` (1-based)
- `?pageSize=<int>` (default 10, dashboard appears to use 10 per page)
- `?search=<string>` (free-text against name/email/phone — every list has a Search box)
- `?sortBy=<field>` + `?sortDir=asc|desc` (UI does not yet show sort affordances but include for future)

**Response envelope (recommended):**
```json
{
  "data": [ /* array of items */ ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

The header badge ("100 users") binds to `meta.total`.

### 3.2 Filters
Each list page has a **Filter** popup with specific dropdowns — exact fields per page are listed in §5 and §6. Filters are passed as query params.

### 3.3 Status Lifecycle
Most provider/center/charity entities have a status. Across the UI we observed these values:
- `Active`, `Inactive` (most user types)
- `Pending` (notification: "waiting for activation")
- `available` (cards on Charitable & Centers — likely an alias for Active)
- Transactions: `Pending`, `Inprogress` (note one-word, no space), `Complete`

Backend should normalize. Recommended canonical enum:
```
UserAccountStatus: 'active' | 'inactive' | 'pending' | 'blocked'
ListingAvailability: 'available' | 'unavailable'
TransactionStatus: 'pending' | 'in_progress' | 'complete' | 'cancelled'
```
The FE will display whatever string the BE returns; align on the values above.

### 3.4 File / Image Uploads
Three screens upload images (Advertisements, Charitable, Centers add forms). Constraint shown to user: **"PNG, JPG up to 10MB"**.

Two options — pick one and document it:
- **(Recommended)** Pre-signed upload: `POST /uploads/presign` → returns `{ uploadUrl, fileUrl }`, FE PUTs file directly to storage, then submits `fileUrl` with the form.
- **(Simpler)** Multipart on the resource itself: `POST /advertisements` with `multipart/form-data` (`image` field + JSON parts).

### 3.5 Errors
Standard JSON error body:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { "fieldName": ["reason"] }
  }
}
```
HTTP status: 400 (validation), 401 (no/expired token), 403 (forbidden), 404 (not found), 409 (conflict), 422 (semantic), 500.

### 3.6 Localization
Login & navbar show a globe icon "EN" — Arabic/English toggle is planned. All user-facing strings will be translated FE-side; backend should accept `Accept-Language: en|ar` and return localized validation messages.

### 3.7 Date Format
- Listing tables show dates as `YYYY-MM-DD` (e.g. transaction date `2026-04-19`, renewal expiry `2026-03-16`).
- Home page date-range picker shows `Jan 1, 2025 — Feb 1, 2025` (full calendar months).
- API: ISO 8601 (`2026-04-19` for dates, `2026-04-19T10:30:00Z` for timestamps).

### 3.8 Phone Numbers
Egyptian mobile format observed: `01228358129`, `01119253120` (11 digits starting with `01`). Validate accordingly.

---

## 4. Core Domain Entities

The following entity types are inferred from the UI and must exist as DB tables / API resources.

### 4.1 User (base for staff + providers + patients + tourists)
Every list row carries an avatar — every user type must support a profile photo.
```
User {
  id: uuid
  type: enum('admin','manager','patient','tourist','hospital','clinic','doctor',
             'pharmacy','lab','medical_issuance','home_care','physical_therapy',
             'employment_office','medical_devices')
  name: string
  email: string (unique)
  phone: string (Egyptian mobile)
  avatarUrl: string|null
  status: 'active'|'inactive'|'pending'|'blocked'
  createdAt, updatedAt
}
```

### 4.2 Patient (extends User where type='patient')
Extra columns visible in `Patients` table:
- `governorate` (e.g. Giza, Cairo)
- `gender` (Male / Female)

### 4.3 Tourist (extends User where type='tourist')
Extra columns visible in `Tourists` table:
- `gender`
*(Tourists table does NOT show governorate or phone — only Name/Status/Email/Gender.)*

### 4.4 Provider (Hospital, Clinic, Doctor, Pharmacy, Lab, Medical Issuance, Home Care, Physical Therapy, Employment Office, Medical Devices)
All ten provider lists share the SAME shape: `name, email, phone, plan, status`. **Doctor** has one extra column: `role` (e.g. "General Practitioner"). The Doctor filter dropdown also exposes **Specialty** and **Subspecialty** — these must be fields on the doctor entity even if not currently displayed in the table.

```
Provider {
  ...User fields...
  planId: uuid  // FK -> Plan
  // doctor-only:
  role: string         // job title / role label
  specialty: string
  subspecialty: string
}
```

> All ten provider types ultimately have the same skeleton (name/email/phone/plan/status). It would be cleanest in the DB to use a **single `providers` table with a discriminator column `type`** plus per-type extension tables (e.g. `doctor_profiles(provider_id, specialty, subspecialty, role)`). The API still exposes them as separate resources (`/hospitals`, `/clinics`, etc.) for clarity.

### 4.5 Plan (Subscription Plan)
File: [plans-add.html](src/app/features/dashboard/pages/plans-add/plans-add.html), [plans-details.html](src/app/features/dashboard/pages/plans-details/plans-details.html)
```
Plan {
  id: uuid
  name: string                       // "Free", "Practice", "Premium"
  type: string                       // "Hospital", "Clinic", "Doctor", ...  -> which provider type this plan applies to
  status: 'active'|'inactive'
  price: decimal                     // e.g. 299
  durationMonths: int                // e.g. 1
  discountPercent: decimal           // e.g. 12 (%)
  description: string                // "Basic presence in the system"
  modules: [PlanModule]              // ordered list of which modules the plan includes
}

PlanModule {
  id: string                         // 'patient', 'appointments', 'analytics', 'billing', 'inventory'
  name: string                       // 'Patient Management', 'Appointments', 'Analytics', 'Billing', 'Inventory'
  included: boolean
  description: string                // shown on plan-details "Modules Details" section
}
```

**Hard-coded module catalog (from `plans-add.ts`):** `patient`, `appointments`, `analytics`, `billing`, `inventory`. Backend must seed these as a `modules` lookup table.

Plan card on `Plans` list (`plans.ts`) also shows a `features` list with `name + included(boolean)` — these are derived from the modules.

### 4.6 Charitable Organization
File: [charitable-add.ts](src/app/features/dashboard/pages/charitable-add/charitable-add.ts) + [charitable-details.html](src/app/features/dashboard/pages/charitable-details/charitable-details.html)
```
CharitableOrganization {
  id: uuid
  name: string
  status: 'active'|'inactive'        // Active/Inactive toggle in form; cards show "available"
  description: string
  notes: string
  coverImageUrl: string
  schedule: [
    { day: 'Saturday'..'Friday', active: bool, from: 'HH:mm', to: 'HH:mm' }
  ]                                  // 7 entries always; `active=false` means "Not Available"
  services: [string]                 // e.g. "Free Medical Consultations"
  contacts: [
    { id, title: string, phone: string }
  ]                                  // e.g. {title:"Hospital", phone:"01119253120"}, {title:"Complaints", ...}
  servicesCount: int (derived = services.length)   // card shows "5 Services"
  contactsCount: int (derived = contacts.length)   // card shows "3 Contacts"
  createdAt, updatedAt
}
```

### 4.7 Medical Center (Dialysis / Hyperbaric Oxygen / Oncology)
File: [dialysis-add.ts](src/app/features/dashboard/pages/Centers/dialysis-add/dialysis-add.ts) (Hyperbaric & Oncology are identical shape, only the URL/category differs).

Same shape as CharitableOrganization **minus** the explicit "services" list, **plus** a category:
```
Center {
  id: uuid
  category: 'dialysis'|'hyperbaric_oxygen'|'oncology'
  name: string                       // "Healthcare For All"
  status: 'active'|'inactive'
  description: string
  notes: string
  coverImageUrl: string
  schedule: [ { day, active, from, to } ]  // 7 entries
  contacts: [ { id, title, phone } ]
  // The cards on the list also show "5 Services" and "3 Contacts" counters.
  // The add form does NOT currently expose a services editor for centers (unlike charitable),
  // but the card displays it - BE should still model a `services: string[]` field
  // so it can be populated/edited later. (See Open Q #1.)
  services: [string]                 // currently shown only as a count on the card
}
```

### 4.8 Advertisement
File: [advertisements.ts](src/app/features/dashboard/pages/advertisements/advertisements.ts) + [advertisements-details.ts](src/app/features/dashboard/pages/advertisements-details/advertisements-details.ts)
```
Advertisement {
  id: uuid
  redirectLink: string               // "yellowpages.com"
  imageUrl: string
  status: 'active'|'inactive'        // not visible yet but backend should support it
  createdAt, updatedAt
}
```
*The edit form's header says "Edit Advertisements" — that's used for both add and edit (route reuses the same component).*

### 4.9 Transaction (Service Request)
File: [transaction.ts](src/app/features/dashboard/pages/transaction/transaction.ts)
```
Transaction {
  id: uuid
  providerId: uuid, providerName, providerAvatarUrl
  serviceType: enum('Tourists','Hospital','Clinic','Doctor','Pharmacy',
                    'Labs & Radiology','Medical Issuance','Home care','Medical Devices')
    // NOTE: the service-type filter tabs include "Tourists" — this likely means
    //       requests originating from tourists (not from a tourist *provider*).
  patientId: uuid, patientName, patientAvatarUrl
  requestType: string                // "Home Visit Request" (only value seen — but BE should keep it a free enum/dimension)
  date: date                         // 2026-04-19
  status: 'pending'|'in_progress'|'complete'|'cancelled'
  createdAt, updatedAt
}
```

### 4.10 Renewal (Expiring Subscription)
File: [renewal.ts](src/app/features/dashboard/pages/renewal/renewal.ts)

Renewal is **not a new entity** — it's a **view** of users whose subscription is about to expire (or has expired). The "Renewal Users" page lists users with `expiredPlan` (their current plan name) and `expiredDate` (subscription end date). The page exposes:
- A `Renewal` button per row.
- A `Renew All Users` bulk action.

```
SubscriptionRecord {
  id: uuid
  userId: uuid (provider)
  planId: uuid
  startDate, endDate                 // endDate = "Expired date"
  status: 'active'|'expired'|'cancelled'|'renewed'
  autoRenew: bool
}
```
The Renewal list = SubscriptionRecords where `endDate <= today + N days` (UI doesn't specify N — confirm with PM; default 30).

### 4.11 Notification (in-app + push)
Two kinds, both visible in the UI:

**(a) Notifications shown in the navbar bell** (`navbar.component.ts`) — system-generated alerts to the admin:
```
SystemNotification {
  id: uuid
  type: 'hospital'|'doctor'|'user'|'clinic'|'lab'|'pharmacy'|... // for icon mapping
  title: string                      // "New Hospital Registration"
  description: string                // "Cairo Medical Center is waiting for activation"
  timestamp: datetime                // displayed as "15 min ago"
  unread: bool
  category: 'userActivity'|'system'  // navbar has two tabs
  link?: string                      // where clicking goes (e.g. provider details to approve)
}
```

**(b) Broadcast notifications composed via the "Send Notifications" page** (`notfication.html`):
```
BroadcastNotification {
  id: uuid
  title: string
  body: string
  targetAudience: 'all'|'doctors'|'hospitals'|'patients'|... (every user type)
  sentAt: datetime
  sentBy: userId (admin)
}
```
Backend must fan-out via push (FCM/APNs) and persist in each recipient's notification feed.

### 4.12 External Medical Devices — Devices & Orders
Menu entries exist (sidebar children: `Devices /dashboard/external/devices`, `Orders /dashboard/external/orders`) but **no routes/components are implemented yet**. Reserve URL space and entities for:
```
ExternalDevice {
  id, name, sku, category, price, stock, imageUrl, status
}
ExternalDeviceOrder {
  id, patientId, items:[{deviceId, qty, price}], total, status, address, createdAt
}
```
*(Implement when the FE adds these pages; the backend can stub now.)*

---

## 5. Component-by-Component Business Analysis

For each screen: **purpose**, **UI elements**, **data needed**, **user actions**, **endpoints consumed**.

### 5.1 Login
**File:** [login.component.html](src/app/features/auth/login.component/login.component.html)
- **Purpose:** Admin/manager signs in.
- **Inputs:** email, password (with show/hide eye toggle).
- **Actions:** Submit → `POST /auth/login`.
- **Missing from UI but should exist on BE side:** rate limiting on login, lockout after N failures. No "forgot password" flow in UI — confirm with PM whether to add later.
- **Endpoints used:** `POST /auth/login`.

### 5.2 Dashboard Shell
**Files:** [dashboard-shell.component.html](src/app/core/layouts/dashboard-shell/dashboard-shell.component/dashboard-shell.component.html), [sidebar.component.html](src/app/core/navigation/sidebar.component/sidebar.component.html), [navbar.component.html](src/app/core/navigation/navbar.component/navbar.component.html).

**Sidebar (left, persistent):**
- HAYAI logo
- Top-level items: Dashboard, Advertisements, Charitable Organizations, Transactions, Renewal Users, Plans Managements, Send Notifications.
- Collapsible groups: **Users** (12 children), **Centers** (3 children), **External Medical Devices** (Devices, Orders).
- Active route highlight via `routerLinkActive`.

**Navbar (top):**
- Page title `Dashboard` (static — does not change per route currently — confirm whether BE-driven or just FE).
- **Language switcher** (globe icon, currently dead UI).
- **Notification bell** (clickable) opens a side panel with:
  - Two tabs: `User Activity` and `System`.
  - List of `SystemNotification` items with icon-by-type, title, description, "15 min ago", and an unread blue dot.
- **User profile chip**: avatar + name (`Eslam mohamed`) + email (`Eslammohamed2@Gmail.com`).
  - *Currently hardcoded.* Wire to `GET /auth/me`.
  - Clicking on the chip should likely open a profile/logout menu (not implemented yet — leave route open).

**Endpoints used:**
- `GET /auth/me` → header user info
- `GET /notifications/system?tab=userActivity|system&unreadOnly=&page=&pageSize=` → bell panel
- `PATCH /notifications/system/:id/read` → mark single read
- `PATCH /notifications/system/mark-all-read?tab=...` → mark all read for active tab
- `GET /notifications/system/unread-count` → red badge counter
- `POST /auth/logout` → on profile menu logout

### 5.3 Home / Overview Dashboard
**File:** [home.component.html](src/app/features/dashboard/pages/home.component/home.component.html)

**Purpose:** High-level analytics landing page.

**UI elements:**
- Greeting `Welcome back, Eslam 👋`. *(Eslam is hardcoded; bind to `auth.currentUser().name`.)*
- **Date-range picker** in the top right — two date pickers (`from`, `to`). All KPIs + charts must filter by this range.
- **4 KPI cards** in a grid, each: icon, title, big value, trend badge ("10.2%" with up arrow):
  1. **Total Users** — count of all platform users.
  2. **New Users** — users created in the selected date range.
  3. **Total Revenue** — sum of plan subscription revenue all-time.
  4. **Period Revenue** — revenue in the selected date range.
- **Chart 1 — Users by Category** (bar chart). Bars for: Patients, Doctors, Hospitals, Clinics, Home care. Has a dropdown filter currently only showing "Hospital" — likely intended to switch the breakdown by provider type.
- **Chart 2 — Revenue by Plan Type** (bar chart). Bars: Basic, Premium, Professional. Dropdown to filter (currently shows "Hospital" — probably to scope revenue to a specific provider type).
- **Chart 3 — User Growth Over Time** (line/area chart). X-axis: Jan…Sep. Y-axis: 0..25 (likely thousands). Dropdown: "All" (probably "by user type").
- **Chart 4 — Revenue Over Time** (line/area chart). Same axes / same dropdown idea.

**Endpoints used:**
- `GET /analytics/overview?from=&to=` → returns the 4 KPI values **with** `trendPercent` field for each (the "10.2%" badge).
  ```json
  {
    "totalUsers":  { "value": 15342, "trendPercent": 10.2 },
    "newUsers":    { "value": 10302, "trendPercent": 10.2 },
    "totalRevenue":{ "value": 140452, "trendPercent": 10.2, "currency": "USD" },
    "periodRevenue":{ "value": 40692, "trendPercent": 10.2, "currency": "USD" }
  }
  ```
- `GET /analytics/users-by-category?from=&to=&providerType=` → bar chart 1.
- `GET /analytics/revenue-by-plan-type?from=&to=&providerType=` → bar chart 2.
- `GET /analytics/user-growth?from=&to=&groupBy=month&providerType=` → line chart 3.
- `GET /analytics/revenue-over-time?from=&to=&groupBy=month&providerType=` → line chart 4.

### 5.4 Advertisements

**List page:** [advertisements.html](src/app/features/dashboard/pages/advertisements/advertisements.html)
- Grid of ad cards: image preview, redirect link displayed below, edit + delete icon buttons on hover.
- Toolbar: Search input, Filter button (popup not shown in HTML so likely status filter only), Add button.

**Add/Edit page:** [advertisements-details.html](src/app/features/dashboard/pages/advertisements-details/advertisements-details.html)
- Back button + page title `Edit Advertisements`.
- Field: **Redirect link** (text).
- Field: **Services Provided** — image upload (PNG/JPG up to 10MB). With remove button.
- Note: there is **no explicit Save button visible in the HTML** — this needs to be added in the FE (mention to BE that we still expect a "Save" call when the form is submitted).

**Endpoints:**
- `GET /advertisements?page=&pageSize=&search=&status=` → list.
- `POST /advertisements` (multipart or json+presigned) → create.
- `GET /advertisements/:id` → load for edit.
- `PATCH /advertisements/:id` → update.
- `DELETE /advertisements/:id` → delete.

### 5.5 Charitable Organizations

**List:** [charitable.html](src/app/features/dashboard/pages/charitable/charitable.html)
- Grid of cards. Each card: cover image, name, status badge "available", a location row ("Healthcare For All"), and counters "3 Contacts • 5 Services".
- Toolbar: Search, Filter (popup: **Status** select with options "Available", "Inactive"), Add.
- Per-card: edit & delete icons on the image, clicking card body opens details.

**Add/Edit:** [charitable-add.html](src/app/features/dashboard/pages/charitable-add/charitable-add.html)
- Section **Basic Information**: Status toggle (Active/Inactive), Organization name, Description, Notes.
- Section **Services Provided** (header is reused — actually image upload): image upload, single image, removable.
- Section **Available Dates & Times**: 7 day-cards (Sat→Fri). Each card: day name, ON/OFF toggle, From + To time inputs (disabled when off).
- Section **Services Provided** (second one): input + "Add Service" button → list of service pills with remove (×).
- Section **Contacts**: row of (Contact name, Phone number, "Add contact" button) → grid of contact cards (title, phone, remove ×).
- Footer: Cancel / Save Changes.

**Details:** [charitable-details.html](src/app/features/dashboard/pages/charitable-details/charitable-details.html)
- Banner image.
- Title + status badge.
- Description, Services Provided (bulleted), Available Dates & Times (7-day grid showing time ranges or "Not Available"), Notes, Contacts (list of 3 sample contact cards).
- Header has Edit + Delete buttons.

**Endpoints:**
- `GET /charitable-organizations?page=&pageSize=&search=&status=`
- `POST /charitable-organizations`
- `GET /charitable-organizations/:id`
- `PATCH /charitable-organizations/:id`
- `DELETE /charitable-organizations/:id`
- *(Image upload via §3.4 convention.)*

### 5.6 Transactions

**File:** [transaction.html](src/app/features/dashboard/pages/transaction/transaction.html)

**Purpose:** Audit all service requests on the platform.

**UI elements:**
- **Main horizontal tab bar** (filters by service type): `All`, `Tourists`, `Hospitals`, `Clinics`, `Doctors`, `Pharmacies`, `Labs & Radiology`, `Medical Issuance`, `Home Care`, `Medical Devices`. (Note: no "Physical Therapy" or "Employment Office" in transaction tabs — confirm whether intentional. **Open Q #2.**)
- **Status sub-tabs:** `Pending`, `In progress`, `Complete`.
- **Card table** with header "Transactions" + badge "100 Transactions" + Search + Filter popup.
  - Filter popup fields: **Service** (select), **Request Type** (select), **Status** (select).
- **Table columns:** checkbox | Provider (avatar + name) | Service | Patient (avatar + name) | Request Type | Date | Status (colored pill: pending=yellow, in-progress=blue, complete=green).
- Bulk-select via header & row checkboxes (no bulk action button is implemented yet — confirm if needed).

**Endpoints:**
- `GET /transactions?page=&pageSize=&search=&serviceType=&status=&requestType=&from=&to=` — supports all filters and the main-tab switching (passing the tab as `serviceType`).
- `GET /transactions/:id` (currently no details page, but BE should expose for future).
- `PATCH /transactions/:id/status` `{ status }` (future — for admin overriding state).
- `GET /transactions/lookups/request-types` → distinct values shown in Request Type filter dropdown.

### 5.7 Renewal Users

**File:** [renewal.html](src/app/features/dashboard/pages/renewal/renewal.html)

**Purpose:** List subscriptions about to expire or expired, with quick-renew action.

**UI elements:**
- Card header "Renewal Users" + badge "100 users" + Search + Filter (popup: **User type**, **Plan**).
- Top-right green button **Renew All Users**.
- Table columns: checkbox | User name (avatar + name) | User type (Doctor/Hospital/Clinic/...) | Expired plan (Practice) | Expired date | per-row green "Renewal" button.

**Endpoints:**
- `GET /subscriptions/renewals?page=&pageSize=&search=&userType=&planId=` → only returns expired/expiring records.
- `POST /subscriptions/:subscriptionId/renew` → renew single (renews for the same duration as the plan).
- `POST /subscriptions/renew-bulk` `{ subscriptionIds?: [], all: bool, filters?: {...} }` → bulk renew (when "Renew All Users" pressed, send `all:true`).
- `GET /subscriptions/lookups/user-types` (could be served from a static config).

### 5.8 Plans Management

**List:** [plans.html](src/app/features/dashboard/pages/plans/plans.html)
- Grid of plan cards. Each card: title (e.g. "Free"), subtitle, description ("Basic presence in the system"), a **plan type badge** ("Hospital") and a features list (✓ included / ✕ not included, with a tooltip info-icon next to each feature).
- Toolbar: Search + Add.

**Add / Edit:** [plans-add.html](src/app/features/dashboard/pages/plans-add/plans-add.html)
- Section **Basic Information**: Plan name, Plan type (select), Status (select).
- Section **Pricing**: Price, Number of months, Discount.
- Section **Modules**: 5 checkboxable cards (`Patient Management`, `Appointments`, `Analytics`, `Billing`, `Inventory`). Each checked module appears in →
- Section **Modules details**: a description input per checked module.
- Footer: Cancel / Save Changes.

**Details:** [plans-details.html](src/app/features/dashboard/pages/plans-details/plans-details.html)
- Plan Overview grid: Plan Name, Plan Type, Price, Discount, Duration, Status.
- Description.
- Modules (pills).
- Modules Details (heading + paragraph per module).
- Header: Edit + Delete.

**Endpoints:**
- `GET /plans?page=&pageSize=&search=&type=&status=`
- `POST /plans`
- `GET /plans/:id`
- `PATCH /plans/:id`
- `DELETE /plans/:id`
- `GET /plans/modules` → catalog of available modules (id + name) — see §7.

### 5.9 Send Notifications

**File:** [notfication.html](src/app/features/dashboard/pages/notfication/notfication.html)
- Form: **Notification title**, **Notification details** (textarea), **Target Audience** (select with: `All Users`, `Doctors`, `Hospitals`, `Patients` — should expand to all 14 user types).
- Single **Send Notification** button.

**Endpoints:**
- `POST /notifications/broadcast` `{ title, body, targetAudience }`.
- `GET /notifications/broadcast/history?page=&pageSize=` — *not in UI yet but recommended; PM may add a history table later.*

### 5.10 Users — all 12 types

All 12 user pages share the SAME shell layout: table card with header (`<Type> name` + "100 users" badge + Search + Filter popup) + table + pagination. They differ only in **columns** and **filter fields**.

Per type, file paths follow `src/app/features/dashboard/pages/users/<type>/<type>.ts`.

| Type | Route | Columns shown | Filter popup fields | 3-dot actions |
|---|---|---|---|---|
| **Patients** | `/dashboard/patient` | checkbox, Name, Status, Email, Phone, Governorate, Gender | Governorate, Gender, Status | **Block user** |
| **Tourists** | `/dashboard/tourist` | checkbox, Name, Status, Email, Gender | Gender, Status | **Block user** |
| **Hospital** | `/dashboard/hospital` | checkbox, Hospital name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Clinics** | `/dashboard/clinics` | checkbox, Clinic name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Doctor** | `/dashboard/doctor` | checkbox, Doctor name, Status, Email, Phone, Plan, Role | Role, Specialty, Subspecialty, Plan, Status | Deactivate, Change plan |
| **Pharmacies** | `/dashboard/pharmacies` | checkbox, Pharmacy name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Labs & Radiology** | `/dashboard/labs` | checkbox, Labs & Radiology name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Medical Issuance** | `/dashboard/issuance` | checkbox, Medical issuance name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Home Care** | `/dashboard/home-care` | checkbox, Home care name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |
| **Physical Therapy** | `/dashboard/therapy` | checkbox, *(same as Home Care)* | Plan, Status | Deactivate, Change plan |
| **Employment Office** | `/dashboard/employment` | checkbox, *(same as Home Care)* | Plan, Status | Deactivate, Change plan |
| **Medical Devices** | `/dashboard/medical-devices` | checkbox, Name, Status, Email, Phone, Plan | Plan, Status | Deactivate, Change plan |

**Notes:**
- **Patients** and **Tourists** lists are end-users — they have a **Block user** action (no plan / no deactivate, since they don't have subscriptions).
- All 10 provider types have **Deactivate** + **Change plan** actions in the 3-dot menu.
- Currently no per-row "View Details" or "Edit" pages exist for these — only the action menu. **Confirm with PM** whether each provider gets a full Detail/Edit page later (Open Q #3); BE should expose `GET /users/:id`, `PATCH /users/:id` regardless.
- The "Change plan" action probably opens a modal with a plan dropdown (modal not yet implemented in the FE) → BE needs `PATCH /users/:id/plan { planId }`.

**Endpoints (per type, ten total resources):**

`/patients`, `/tourists`, `/hospitals`, `/clinics`, `/doctors`, `/pharmacies`, `/labs`, `/medical-issuance`, `/home-care`, `/physical-therapy`, `/employment-offices`, `/medical-devices`.

For **each** of those resources expose the standard set:
- `GET /<resource>?page=&pageSize=&search=&status=&plan=&...(per-type filters above)`
- `GET /<resource>/:id`
- `POST /<resource>` *(create — not used by admin UI today since users sign up via the public app; expose for future and for seeding/testing)*
- `PATCH /<resource>/:id`
- `DELETE /<resource>/:id`
- `PATCH /<resource>/:id/status` `{ status }` — used for `Deactivate` / `Activate` / `Block`.
- `PATCH /<resource>/:id/plan` `{ planId }` — used by `Change plan` (provider types only).

Reference data needed (see §7):
- Governorates list (Patient filter dropdown).
- Genders list (Male/Female).
- Doctor: Roles, Specialties, Subspecialties (filter dropdowns).
- Plans list (for "Change plan" dropdown and for filter).

### 5.11 Centers — Dialysis / Hyperbaric Oxygen / Oncology

Three identical sub-modules. For each:

**List page** (e.g. [dialysis.html](src/app/features/dashboard/pages/Centers/dialysis/dialysis.html))
- Grid of cards: image, name, status badge "available", location row, "3 Contacts • 5 Services" stats. Edit + Delete icons over the image. Clicking card body opens details.
- Toolbar: Search, Filter (popup: **Status**), Add.

**Add/Edit form** (e.g. [dialysis-add.html](src/app/features/dashboard/pages/Centers/dialysis-add/dialysis-add.html))
- Section **Basic Information**: Status toggle (Active/Inactive), Organization name, Description (textarea), Notes (textarea).
- Section **Services Provided**: image upload + preview + remove.
- Section **Available Dates & Times**: 7 day-cards with day/toggle/from/to (identical to Charitable).
- Section **Contacts**: Add row (name + phone + Add) + grid of contact cards with remove.
- Footer: Cancel / Save Changes.

> **Note vs Charitable:** the Centers Add forms currently **do NOT** include an editable "Services" pill list. The card on the list view does still display a `services` count — so the BE should expose the field (we'll add the editor UI later).

**Details** (e.g. [dialysis-details.html](src/app/features/dashboard/pages/Centers/dialysis-details/dialysis-details.html))
- Banner image with title overlay + status badge.
- Description, Available Dates & Times (7-day grid), Notes, Contacts.
- Header: Edit + Delete buttons.

**Endpoints (per category):**

Use ONE shared resource with a `?category=` filter, **or** three separate resources. Recommendation: **one resource** `/centers` with `category` as a column.

- `GET /centers?category=dialysis|hyperbaric_oxygen|oncology&page=&pageSize=&search=&status=`
- `POST /centers` (`category` in body)
- `GET /centers/:id`
- `PATCH /centers/:id`
- `DELETE /centers/:id`

### 5.12 External Medical Devices

**Sidebar shows two children** but **no Angular routes are registered yet** in `dashboard.routes.ts`:
- `Devices` → `/dashboard/external/devices`
- `Orders` → `/dashboard/external/orders`

The FE will add these pages later. Backend can stub:
- `GET/POST/PATCH/DELETE /external-devices`
- `GET/POST/PATCH/DELETE /external-device-orders`
- `PATCH /external-device-orders/:id/status`

---

## 6. Complete REST API Endpoint Catalog

> **Base URL:** `https://api.hayai.<env>/v1`
> **Auth:** `Authorization: Bearer <jwt>` on every endpoint except `POST /auth/login` and `POST /auth/refresh`.
> **Content-Type:** `application/json` everywhere unless noted (only file upload to S3/CDN is binary).
> **Response wrapping:** list endpoints wrap data in `{ data, meta }` (see §3.1). Single-resource endpoints return the resource directly. Errors follow §3.5.
>
> Every endpoint below shows: **Request body** (or query) and **Response body** with a realistic example. Optional fields are marked with `// optional`.

---

### 6.1 Auth

#### 6.1.1 — `POST /auth/login` — Login
**Request**
```json
{ "email": "admin@hayai.com", "password": "P@ssw0rd!" }
```
**Response 200**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "u_9b0e",
    "name": "Eslam Mohamed",
    "email": "eslammohamed2@gmail.com",
    "role": "admin",
    "avatarUrl": "https://cdn.hayai.com/avatars/eslam.png"
  }
}
```
**Errors:** `401 INVALID_CREDENTIALS`, `403 ACCOUNT_LOCKED`, `429 RATE_LIMITED`.

#### 6.1.2 — `POST /auth/refresh` — Refresh access token
**Request**
```json
{ "refreshToken": "eyJhbGciOi..." }
```
**Response 200**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

#### 6.1.3 — `POST /auth/logout` — Logout
**Request**
```json
{ "refreshToken": "eyJhbGciOi..." }
```
**Response 204** (no body)

#### 6.1.4 — `GET /auth/me` — Current user
**Request:** no body.
**Response 200**
```json
{
  "id": "u_9b0e",
  "name": "Eslam Mohamed",
  "email": "eslammohamed2@gmail.com",
  "role": "admin",
  "avatarUrl": "https://cdn.hayai.com/avatars/eslam.png",
  "lastLoginAt": "2026-05-24T08:32:11Z"
}
```

#### 6.1.5 — `PATCH /auth/me` — Edit own profile
**Request** (all fields optional)
```json
{ "name": "Eslam M. Mohamed", "email": "eslam@hayai.com", "avatarUrl": "https://cdn.hayai.com/avatars/eslam-new.png" }
```
**Response 200**: same shape as 6.1.4.

#### 6.1.6 — `POST /auth/change-password`
**Request**
```json
{ "currentPassword": "P@ssw0rd!", "newPassword": "N3wP@ss!" }
```
**Response 204** (no body). **Errors:** `400 WEAK_PASSWORD`, `401 WRONG_CURRENT_PASSWORD`.

---

### 6.2 Analytics (Home page)

#### 6.2.1 — `GET /analytics/overview` — 4 KPI cards
**Query:** `from=2025-01-01&to=2025-02-01`
**Response 200**
```json
{
  "totalUsers":    { "value": 15342, "trendPercent": 10.2 },
  "newUsers":      { "value": 10302, "trendPercent": 10.2 },
  "totalRevenue":  { "value": 140452, "trendPercent": 10.2, "currency": "EGP" },
  "periodRevenue": { "value": 40692,  "trendPercent": 10.2, "currency": "EGP" }
}
```
> `trendPercent` is compared against the previous period of the same length (see Open Q #8).

#### 6.2.2 — `GET /analytics/users-by-category` — Bar chart 1
**Query:** `from=2025-01-01&to=2025-02-01&providerType=hospital` *(providerType optional)*
**Response 200**
```json
{
  "currency": null,
  "items": [
    { "label": "Patients",  "value": 45000 },
    { "label": "Doctors",   "value": 35000 },
    { "label": "Hospitals", "value": 22000 },
    { "label": "Clinics",   "value": 30000 },
    { "label": "Home care", "value": 37000 }
  ]
}
```

#### 6.2.3 — `GET /analytics/revenue-by-plan-type` — Bar chart 2
**Query:** `from=2025-01-01&to=2025-02-01&providerType=hospital`
**Response 200**
```json
{
  "currency": "EGP",
  "items": [
    { "label": "Basic",        "value": 35000 },
    { "label": "Premium",      "value": 50000 },
    { "label": "Professional", "value": 34460 }
  ]
}
```

#### 6.2.4 — `GET /analytics/user-growth` — Line/area chart 3
**Query:** `from=2025-01-01&to=2025-09-30&groupBy=month&providerType=`
**Response 200**
```json
{
  "groupBy": "month",
  "series": [
    { "label": "Jan", "value": 10 },
    { "label": "Feb", "value": 14 },
    { "label": "Mar", "value": 11 },
    { "label": "Apr", "value": 17 },
    { "label": "May", "value": 13 },
    { "label": "Jun", "value": 14 },
    { "label": "Jul", "value": 8  },
    { "label": "Aug", "value": 15 },
    { "label": "Sep", "value": 13 }
  ]
}
```

#### 6.2.5 — `GET /analytics/revenue-over-time` — Line/area chart 4
**Query:** `from=2025-01-01&to=2025-09-30&groupBy=month&providerType=`
**Response 200**
```json
{
  "groupBy": "month",
  "currency": "EGP",
  "series": [
    { "label": "Jan", "value": 12000 },
    { "label": "Feb", "value": 16000 },
    { "label": "Mar", "value": 9500 },
    { "label": "Apr", "value": 18000 },
    { "label": "May", "value": 13000 },
    { "label": "Jun", "value": 17000 },
    { "label": "Jul", "value": 7500  },
    { "label": "Aug", "value": 15500 },
    { "label": "Sep", "value": 14200 }
  ]
}
```

---

### 6.3 Advertisements

#### 6.3.1 — `GET /advertisements` — List
**Query:** `?page=1&pageSize=10&search=&status=active`
**Response 200**
```json
{
  "data": [
    {
      "id": "ad_1",
      "redirectLink": "https://yellowpages.com",
      "imageUrl": "https://cdn.hayai.com/ads/1.jpg",
      "status": "active",
      "createdAt": "2026-05-01T10:00:00Z",
      "updatedAt": "2026-05-01T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 6, "totalPages": 1 }
}
```

#### 6.3.2 — `POST /advertisements` — Create
**Request**
```json
{
  "redirectLink": "https://yellowpages.com",
  "imageUrl": "https://cdn.hayai.com/ads/uploaded-key.jpg",
  "status": "active"
}
```
**Response 201**: same shape as a single item in 6.3.1.

#### 6.3.3 — `GET /advertisements/:id` — Get one (for edit form)
**Response 200**: same shape as a single item in 6.3.1.

#### 6.3.4 — `PATCH /advertisements/:id` — Update
**Request** (all fields optional)
```json
{ "redirectLink": "https://newlink.com", "imageUrl": "https://cdn.hayai.com/ads/new.jpg", "status": "inactive" }
```
**Response 200**: full updated resource.

#### 6.3.5 — `DELETE /advertisements/:id` — Delete
**Response 204** (no body).

---

### 6.4 Charitable Organizations

#### 6.4.1 — `GET /charitable-organizations` — List
**Query:** `?page=1&pageSize=10&search=&status=active`
**Response 200**
```json
{
  "data": [
    {
      "id": "org_1",
      "name": "Healthcare For All",
      "status": "active",
      "coverImageUrl": "https://cdn.hayai.com/orgs/1.jpg",
      "locationLabel": "Healthcare For All",
      "servicesCount": 5,
      "contactsCount": 3,
      "createdAt": "2026-04-12T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

#### 6.4.2 — `POST /charitable-organizations` — Create
**Request**
```json
{
  "name": "Healthcare For All",
  "status": "active",
  "description": "Established in 2010, Al Noor Hospital is a leading healthcare facility...",
  "notes": "Established in 2010, Al Noor Hospital is a leading healthcare facility...",
  "coverImageUrl": "https://cdn.hayai.com/orgs/uploaded.jpg",
  "schedule": [
    { "day": "saturday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "sunday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "monday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "tuesday",   "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "wednesday", "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "thursday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "friday",    "active": false, "from": null,    "to": null }
  ],
  "services": [
    "Free Medical Consultations",
    "Patient Transportation",
    "Child Healthcare Support",
    "Elderly Care Assistance",
    "Chronic Disease Support"
  ],
  "contacts": [
    { "title": "Hospital",                          "phone": "01119253120" },
    { "title": "Home Care Manager (Mohamed Ali)",   "phone": "01119253120" },
    { "title": "Complaints",                        "phone": "01119253120" }
  ]
}
```
**Response 201**: same shape as 6.4.3.

#### 6.4.3 — `GET /charitable-organizations/:id` — Details + edit prefill
**Response 200**
```json
{
  "id": "org_1",
  "name": "Healthcare For All",
  "status": "active",
  "description": "Established in 2010, Al Noor Hospital ...",
  "notes": "Established in 2010, Al Noor Hospital ...",
  "coverImageUrl": "https://cdn.hayai.com/orgs/1.jpg",
  "schedule": [
    { "day": "saturday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "sunday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "monday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "tuesday",   "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "wednesday", "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "thursday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "friday",    "active": false, "from": null,    "to": null }
  ],
  "services": [
    "Free Medical Consultations",
    "Patient Transportation",
    "Child Healthcare Support",
    "Elderly Care Assistance",
    "Chronic Disease Support"
  ],
  "contacts": [
    { "id": "c_1", "title": "Hospital",                        "phone": "01119253120" },
    { "id": "c_2", "title": "Home Care Manager (Mohamed Ali)", "phone": "01119253120" },
    { "id": "c_3", "title": "Complaints",                      "phone": "01119253120" }
  ],
  "servicesCount": 5,
  "contactsCount": 3,
  "createdAt": "2026-04-12T10:00:00Z",
  "updatedAt": "2026-05-10T12:11:00Z"
}
```

#### 6.4.4 — `PATCH /charitable-organizations/:id` — Update
**Request:** any subset of the create payload (e.g. to toggle status only)
```json
{ "status": "inactive" }
```
**Response 200**: full updated resource.

#### 6.4.5 — `DELETE /charitable-organizations/:id`
**Response 204** (no body).

---

### 6.5 Transactions

#### 6.5.1 — `GET /transactions` — List with filters
**Query:** `?page=1&pageSize=10&search=&serviceType=doctor&status=pending&requestType=home_visit&from=2026-04-01&to=2026-04-30`
- `serviceType` ∈ `tourist | hospital | clinic | doctor | pharmacy | lab | medical_issuance | home_care | medical_devices` (the main horizontal tabs; pass nothing or `all` to bypass).
- `status` ∈ `pending | in_progress | complete | cancelled`.

**Response 200**
```json
{
  "data": [
    {
      "id": "tx_1",
      "provider": {
        "id": "u_010",
        "name": "Olivia Rhye",
        "avatarUrl": "https://i.pravatar.cc/150?img=1",
        "type": "doctor"
      },
      "patient": {
        "id": "u_500",
        "name": "Dr. Kareem Mohamed",
        "avatarUrl": "https://i.pravatar.cc/150?img=11"
      },
      "serviceType": "doctor",
      "requestType": "home_visit",
      "requestTypeLabel": "Home Visit Request",
      "date": "2026-04-19",
      "status": "pending",
      "createdAt": "2026-04-19T08:11:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 }
}
```

#### 6.5.2 — `GET /transactions/:id` — Details (future use)
**Response 200**
```json
{
  "id": "tx_1",
  "provider": { "id":"u_010", "name":"Olivia Rhye", "avatarUrl":"...", "type":"doctor" },
  "patient":  { "id":"u_500", "name":"Dr. Kareem Mohamed", "avatarUrl":"..." },
  "serviceType": "doctor",
  "requestType": "home_visit",
  "requestTypeLabel": "Home Visit Request",
  "date": "2026-04-19",
  "status": "pending",
  "notes": null,
  "history": [
    { "status": "pending", "at": "2026-04-19T08:11:00Z", "by": null }
  ],
  "createdAt": "2026-04-19T08:11:00Z",
  "updatedAt": "2026-04-19T08:11:00Z"
}
```

#### 6.5.3 — `PATCH /transactions/:id/status` — Admin override
**Request**
```json
{ "status": "in_progress", "note": "Confirmed by admin" }
```
**Response 200**: full updated transaction (same shape as 6.5.2).

#### 6.5.4 — `GET /transactions/lookups/request-types`
**Response 200**
```json
[
  { "id": "home_visit",       "label": "Home Visit Request" },
  { "id": "clinic_visit",     "label": "Clinic Visit Request" },
  { "id": "lab_test",         "label": "Lab Test Request" },
  { "id": "prescription",     "label": "Prescription Request" }
]
```

#### 6.5.5 — `GET /transactions/lookups/service-types`
**Response 200**
```json
[
  { "id": "tourist",          "label": "Tourists" },
  { "id": "hospital",         "label": "Hospitals" },
  { "id": "clinic",           "label": "Clinics" },
  { "id": "doctor",           "label": "Doctors" },
  { "id": "pharmacy",         "label": "Pharmacies" },
  { "id": "lab",              "label": "Labs & Radiology" },
  { "id": "medical_issuance", "label": "Medical Issuance" },
  { "id": "home_care",        "label": "Home Care" },
  { "id": "medical_devices",  "label": "Medical Devices" }
]
```

---

### 6.6 Subscriptions & Renewals

#### 6.6.1 — `GET /subscriptions/renewals` — Renewal list
**Query:** `?page=1&pageSize=10&search=&userType=doctor&planId=plan_practice`
**Response 200**
```json
{
  "data": [
    {
      "subscriptionId": "sub_1",
      "user": {
        "id": "u_010",
        "name": "Olivia Rhye",
        "avatarUrl": "https://i.pravatar.cc/150?img=1",
        "type": "doctor",
        "typeLabel": "Doctor"
      },
      "plan": { "id": "plan_practice", "name": "Practice" },
      "expiredDate": "2026-03-16",
      "status": "expired"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 }
}
```

#### 6.6.2 — `POST /subscriptions/:id/renew` — Renew one
**Request** (`months` optional — defaults to plan's `durationMonths`)
```json
{ "months": 1 }
```
**Response 200**
```json
{
  "subscriptionId": "sub_1",
  "userId": "u_010",
  "planId": "plan_practice",
  "startedAt": "2026-05-24",
  "endedAt": "2026-06-24",
  "status": "active",
  "renewedAt": "2026-05-24T12:00:00Z"
}
```

#### 6.6.3 — `POST /subscriptions/renew-bulk` — Renew All / selected
**Request** (one of `subscriptionIds`, `all`)
```json
{ "subscriptionIds": ["sub_1","sub_2"], "all": false, "months": 1 }
```
or
```json
{ "all": true, "filters": { "userType": "doctor", "planId": "plan_practice" }, "months": 1 }
```
**Response 200**
```json
{ "renewed": 2, "skipped": 0, "failed": [] }
```

#### 6.6.4 — `GET /subscriptions/:id` — Get one
**Response 200**
```json
{
  "id": "sub_1",
  "userId": "u_010",
  "planId": "plan_practice",
  "startedAt": "2025-03-16",
  "endedAt": "2026-03-16",
  "status": "expired",
  "autoRenew": false,
  "createdAt": "2025-03-16T10:00:00Z"
}
```

#### 6.6.5 — `POST /subscriptions` — Create manually (future)
**Request**
```json
{ "userId": "u_010", "planId": "plan_practice", "durationMonths": 12, "autoRenew": false }
```
**Response 201**: same shape as 6.6.4.

---

### 6.7 Plans

#### 6.7.1 — `GET /plans` — List
**Query:** `?page=1&pageSize=10&search=&type=hospital&status=active`
**Response 200**
```json
{
  "data": [
    {
      "id": "plan_free_hospital",
      "name": "Free",
      "type": "hospital",
      "typeLabel": "Hospital",
      "status": "active",
      "price": 0,
      "currency": "EGP",
      "durationMonths": 1,
      "discountPercent": 0,
      "description": "Basic presence in the system",
      "features": [
        { "name": "Professional Profile", "included": true },
        { "name": "Profile Preview",      "included": true },
        { "name": "View Patient File",    "included": true },
        { "name": "No requests",          "included": false },
        { "name": "No patient management","included": false }
      ]
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 3, "totalPages": 1 }
}
```

#### 6.7.2 — `POST /plans` — Create
**Request**
```json
{
  "name": "Premium",
  "type": "hospital",
  "status": "active",
  "price": 299,
  "currency": "EGP",
  "durationMonths": 1,
  "discountPercent": 12,
  "description": "Full access to all modules",
  "modules": [
    { "id": "patient",      "included": true,  "description": "Complete patient record management system" },
    { "id": "appointments", "included": true,  "description": "Schedule and manage patient appointments" },
    { "id": "analytics",    "included": true,  "description": "Advanced analytics and reporting dashboard" },
    { "id": "billing",      "included": true,  "description": "Integrated billing and payment processing" },
    { "id": "inventory",    "included": false, "description": null }
  ]
}
```
**Response 201**: same shape as 6.7.3.

#### 6.7.3 — `GET /plans/:id` — Details
**Response 200**
```json
{
  "id": "plan_premium_hospital",
  "name": "Premium",
  "type": "hospital",
  "typeLabel": "Hospital",
  "status": "active",
  "price": 299,
  "currency": "EGP",
  "durationMonths": 1,
  "discountPercent": 12,
  "description": "Full access to all modules",
  "modules": [
    { "id": "patient",      "name": "Patient Management", "included": true,  "description": "Complete patient record management system" },
    { "id": "appointments", "name": "Appointments",       "included": true,  "description": "Schedule and manage patient appointments" },
    { "id": "analytics",    "name": "Analytics",          "included": true,  "description": "Advanced analytics and reporting dashboard" },
    { "id": "billing",      "name": "Billing",            "included": true,  "description": "Integrated billing and payment processing" },
    { "id": "inventory",    "name": "Inventory",          "included": false, "description": null }
  ],
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-05-12T08:00:00Z"
}
```

#### 6.7.4 — `PATCH /plans/:id` — Update
**Request:** any subset of create payload (e.g.)
```json
{ "price": 349, "modules": [{ "id": "inventory", "included": true, "description": "Inventory tracking" }] }
```
**Response 200**: full updated resource.

#### 6.7.5 — `DELETE /plans/:id`
**Response 204** (no body). **Errors:** `409 PLAN_IN_USE` if there are active subscriptions.

#### 6.7.6 — `GET /plans/modules` — Module catalog
**Response 200**
```json
[
  { "id": "patient",      "name": "Patient Management" },
  { "id": "appointments", "name": "Appointments" },
  { "id": "analytics",    "name": "Analytics" },
  { "id": "billing",      "name": "Billing" },
  { "id": "inventory",    "name": "Inventory" }
]
```

---

### 6.8 Notifications

#### 6.8.1 — `GET /notifications/system` — Navbar bell panel
**Query:** `?tab=userActivity&unreadOnly=false&page=1&pageSize=20`
- `tab` ∈ `userActivity | system`.

**Response 200**
```json
{
  "data": [
    {
      "id": "n_1",
      "type": "hospital",
      "title": "New Hospital Registration",
      "description": "Cairo Medical Center is waiting for activation",
      "timestamp": "2026-05-24T08:17:00Z",
      "relativeTime": "15 min ago",
      "unread": true,
      "category": "userActivity",
      "link": "/dashboard/hospital?focus=u_h_42"
    },
    {
      "id": "n_2",
      "type": "doctor",
      "title": "New Doctor Signup",
      "description": "Dr. Mohamed Ali is waiting for activation",
      "timestamp": "2026-05-24T08:02:00Z",
      "relativeTime": "30 min ago",
      "unread": true,
      "category": "userActivity",
      "link": "/dashboard/doctor?focus=u_d_77"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

#### 6.8.2 — `GET /notifications/system/unread-count` — Bell badge
**Response 200**
```json
{ "userActivity": 3, "system": 2, "total": 5 }
```

#### 6.8.3 — `PATCH /notifications/system/:id/read`
**Request:** no body.
**Response 200**
```json
{ "id": "n_1", "unread": false, "readAt": "2026-05-24T08:35:00Z" }
```

#### 6.8.4 — `PATCH /notifications/system/mark-all-read`
**Query:** `?tab=userActivity` (or `system`, or omit for both).
**Response 200**
```json
{ "markedRead": 3 }
```

#### 6.8.5 — `POST /notifications/broadcast` — Send notification
**Request**
```json
{
  "title": "System maintenance tonight",
  "body": "We will be down 02:00–04:00 Cairo time.",
  "targetAudience": {
    "type": "user_type",
    "userTypes": ["hospital","clinic"]
  }
}
```
> `targetAudience.type` ∈ `all | user_type | segment`.
> When `user_type`: provide `userTypes: string[]` from §7 `/lookups/user-types`.
> When `segment` (future): provide a `filters` object.

**Response 202**
```json
{
  "broadcastId": "br_1",
  "title": "System maintenance tonight",
  "body": "We will be down 02:00–04:00 Cairo time.",
  "targetAudience": { "type": "user_type", "userTypes": ["hospital","clinic"] },
  "queuedRecipients": 1240,
  "sentBy": "u_9b0e",
  "sentAt": "2026-05-24T09:00:00Z"
}
```

#### 6.8.6 — `GET /notifications/broadcast/history` (future)
**Query:** `?page=1&pageSize=10`
**Response 200**
```json
{
  "data": [
    {
      "broadcastId": "br_1",
      "title": "System maintenance tonight",
      "body": "We will be down 02:00–04:00 Cairo time.",
      "targetAudience": { "type": "user_type", "userTypes": ["hospital","clinic"] },
      "queuedRecipients": 1240,
      "deliveredRecipients": 1198,
      "readRecipients": 932,
      "sentAt": "2026-05-24T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

---

### 6.9 Users — 12 resources × 7 standard ops

Every list page (Patients, Tourists, Hospitals, Clinics, Doctors, Pharmacies, Labs, Medical Issuance, Home Care, Physical Therapy, Employment Offices, Medical Devices) gets the **same** 7 endpoints. The base path differs (see table). Below is **one fully-specified example per category** (one for end-users, one for the most complex provider — Doctor); the other 10 follow the same pattern and only differ in the columns/filters table in §5.10.

**Resource → path map:**

| Resource | Path |
|---|---|
| Patients | `/patients` |
| Tourists | `/tourists` |
| Hospitals | `/hospitals` |
| Clinics | `/clinics` |
| Doctors | `/doctors` |
| Pharmacies | `/pharmacies` |
| Labs & Radiology | `/labs` |
| Medical Issuance | `/medical-issuance` |
| Home Care | `/home-care` |
| Physical Therapy | `/physical-therapy` |
| Employment Offices | `/employment-offices` |
| Medical Devices | `/medical-devices` |

#### 6.9.A — Standard ops, example: `/patients`

##### 6.9.A.1 — `GET /patients` — List
**Query:** `?page=1&pageSize=10&search=oli&governorate=giza&gender=female&status=active`
**Response 200**
```json
{
  "data": [
    {
      "id": "u_p_1",
      "name": "Olivia Rhye",
      "email": "olivia@untitledui.com",
      "phone": "01228358129",
      "avatarUrl": "https://i.pravatar.cc/150?img=1",
      "governorate": "Giza",
      "gender": "female",
      "status": "active",
      "createdAt": "2025-09-12T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 }
}
```

##### 6.9.A.2 — `GET /patients/:id`
**Response 200**
```json
{
  "id": "u_p_1",
  "name": "Olivia Rhye",
  "email": "olivia@untitledui.com",
  "phone": "01228358129",
  "avatarUrl": "https://i.pravatar.cc/150?img=1",
  "governorate": "Giza",
  "gender": "female",
  "status": "active",
  "createdAt": "2025-09-12T08:00:00Z",
  "updatedAt": "2026-04-10T12:00:00Z"
}
```

##### 6.9.A.3 — `POST /patients` — Create (admin manual, future)
**Request**
```json
{
  "name": "Olivia Rhye",
  "email": "olivia@untitledui.com",
  "phone": "01228358129",
  "governorate": "Giza",
  "gender": "female",
  "status": "active",
  "avatarUrl": "https://cdn.hayai.com/avatars/olivia.png"
}
```
**Response 201**: same shape as 6.9.A.2.

##### 6.9.A.4 — `PATCH /patients/:id`
**Request:** any subset of create payload.
```json
{ "governorate": "Cairo", "phone": "01099887766" }
```
**Response 200**: full updated resource.

##### 6.9.A.5 — `DELETE /patients/:id`
**Response 204** (no body).

##### 6.9.A.6 — `PATCH /patients/:id/status` — Block / Unblock
**Request**
```json
{ "status": "blocked" }
```
> Valid for patients/tourists: `active | blocked`.
> Valid for providers: `active | inactive`.

**Response 200**
```json
{ "id": "u_p_1", "status": "blocked", "updatedAt": "2026-05-24T09:30:00Z" }
```

##### 6.9.A.7 — `PATCH /patients/:id/plan`
**Not applicable to patients/tourists.** Returns `404` or `405` if called.

---

#### 6.9.B — Standard ops, example: `/doctors` (the most complex)

##### 6.9.B.1 — `GET /doctors` — List
**Query:** `?page=1&pageSize=10&search=&role=gp&specialty=internal_medicine&subspecialty=cardiology&plan=plan_practice&status=active`
**Response 200**
```json
{
  "data": [
    {
      "id": "u_d_1",
      "name": "Olivia Rhye",
      "email": "olivia@untitledui.com",
      "phone": "01228358129",
      "avatarUrl": "https://i.pravatar.cc/150?img=1",
      "plan": { "id": "plan_practice", "name": "Practice" },
      "role": "General Practitioner",
      "specialty": "Internal Medicine",
      "subspecialty": "Cardiology",
      "status": "active",
      "createdAt": "2025-08-01T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 }
}
```

##### 6.9.B.2 — `GET /doctors/:id`
**Response 200**: same shape as a list item.

##### 6.9.B.3 — `POST /doctors` (admin manual, future)
**Request**
```json
{
  "name": "Olivia Rhye",
  "email": "olivia@untitledui.com",
  "phone": "01228358129",
  "avatarUrl": "https://cdn.hayai.com/avatars/olivia.png",
  "planId": "plan_practice",
  "role": "General Practitioner",
  "specialty": "Internal Medicine",
  "subspecialty": "Cardiology",
  "status": "active"
}
```
**Response 201**: same shape as 6.9.B.2.

##### 6.9.B.4 — `PATCH /doctors/:id`
**Request:** any subset of create payload, e.g.
```json
{ "subspecialty": "Endocrinology" }
```
**Response 200**: full updated resource.

##### 6.9.B.5 — `DELETE /doctors/:id`
**Response 204**.

##### 6.9.B.6 — `PATCH /doctors/:id/status` — Deactivate / Activate
**Request**
```json
{ "status": "inactive" }
```
**Response 200**
```json
{ "id": "u_d_1", "status": "inactive", "updatedAt": "2026-05-24T09:30:00Z" }
```

##### 6.9.B.7 — `PATCH /doctors/:id/plan` — Change plan
**Request**
```json
{ "planId": "plan_premium_doctor" }
```
**Response 200**
```json
{
  "id": "u_d_1",
  "plan": { "id": "plan_premium_doctor", "name": "Premium" },
  "subscription": {
    "id": "sub_55",
    "startedAt": "2026-05-24",
    "endedAt": "2026-06-24"
  }
}
```

---

#### 6.9.C — Tourists / Hospitals / Clinics / Pharmacies / Labs / Medical Issuance / Home Care / Physical Therapy / Employment Offices / Medical Devices

Same 7 ops as above (`GET`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/status`, `PATCH /:id/plan` — except Tourists which is like Patients with no `/plan`).

Resource item shapes:

- **`/tourists` item**
```json
{
  "id": "u_t_1",
  "name": "Olivia Rhye",
  "email": "olivia@untitledui.com",
  "avatarUrl": "https://i.pravatar.cc/150?img=1",
  "gender": "female",
  "status": "active",
  "createdAt": "2025-09-12T08:00:00Z"
}
```

- **Generic provider item** (Hospitals, Clinics, Pharmacies, Labs, Medical Issuance, Home Care, Physical Therapy, Employment Offices, Medical Devices)
```json
{
  "id": "u_h_1",
  "name": "Olivia Rhye",
  "email": "olivia@untitledui.com",
  "phone": "01228358129",
  "avatarUrl": "https://i.pravatar.cc/150?img=1",
  "plan": { "id": "plan_practice", "name": "Practice" },
  "status": "active",
  "createdAt": "2025-09-12T08:00:00Z"
}
```

Create/update payload for generic provider:
```json
{
  "name": "City Hospital",
  "email": "info@cityhospital.com",
  "phone": "01228358129",
  "avatarUrl": "https://cdn.hayai.com/avatars/h1.png",
  "planId": "plan_practice",
  "status": "active"
}
```

`PATCH /<resource>/:id/status` body: `{ "status": "active" | "inactive" }`
`PATCH /<resource>/:id/plan` body: `{ "planId": "plan_premium_hospital" }`

**Per-resource filter query params** (in addition to `page,pageSize,search`):

| Resource | Filter query params |
|---|---|
| `/patients` | `governorate`, `gender`, `status` |
| `/tourists` | `gender`, `status` |
| `/hospitals` | `plan`, `status` |
| `/clinics` | `plan`, `status` |
| `/doctors` | `role`, `specialty`, `subspecialty`, `plan`, `status` |
| `/pharmacies` | `plan`, `status` |
| `/labs` | `plan`, `status` |
| `/medical-issuance` | `plan`, `status` |
| `/home-care` | `plan`, `status` |
| `/physical-therapy` | `plan`, `status` |
| `/employment-offices` | `plan`, `status` |
| `/medical-devices` | `plan`, `status` |

---

### 6.10 Centers (Dialysis / Hyperbaric Oxygen / Oncology)

#### 6.10.1 — `GET /centers` — List
**Query:** `?category=dialysis&page=1&pageSize=10&search=&status=active`
> `category` ∈ `dialysis | hyperbaric_oxygen | oncology` (required).

**Response 200**
```json
{
  "data": [
    {
      "id": "ct_1",
      "category": "dialysis",
      "name": "Healthcare For All",
      "status": "active",
      "coverImageUrl": "https://cdn.hayai.com/centers/1.jpg",
      "locationLabel": "Healthcare For All",
      "servicesCount": 5,
      "contactsCount": 3,
      "createdAt": "2026-04-12T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 6, "totalPages": 1 }
}
```

#### 6.10.2 — `POST /centers` — Create
**Request**
```json
{
  "category": "dialysis",
  "name": "Healthcare For All",
  "status": "active",
  "description": "Established in 2010 ...",
  "notes": "Established in 2010 ...",
  "coverImageUrl": "https://cdn.hayai.com/centers/uploaded.jpg",
  "schedule": [
    { "day": "saturday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "sunday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "monday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "tuesday",   "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "wednesday", "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "thursday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "friday",    "active": false, "from": null,    "to": null }
  ],
  "services": [],
  "contacts": [
    { "title": "Hospital",                        "phone": "01119253120" },
    { "title": "Home Care Manager (Mohamed Ali)", "phone": "01119253120" },
    { "title": "Complaints",                      "phone": "01119253120" }
  ]
}
```
**Response 201**: same shape as 6.10.3.

#### 6.10.3 — `GET /centers/:id`
**Response 200**
```json
{
  "id": "ct_1",
  "category": "dialysis",
  "name": "Healthcare For All",
  "status": "active",
  "description": "Established in 2010 ...",
  "notes": "Established in 2010 ...",
  "coverImageUrl": "https://cdn.hayai.com/centers/1.jpg",
  "schedule": [
    { "day": "saturday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "sunday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "monday",    "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "tuesday",   "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "wednesday", "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "thursday",  "active": true,  "from": "10:00", "to": "20:00" },
    { "day": "friday",    "active": false, "from": null,    "to": null }
  ],
  "services": [],
  "contacts": [
    { "id": "cc_1", "title": "Hospital",                        "phone": "01119253120" },
    { "id": "cc_2", "title": "Home Care Manager (Mohamed Ali)", "phone": "01119253120" },
    { "id": "cc_3", "title": "Complaints",                      "phone": "01119253120" }
  ],
  "servicesCount": 0,
  "contactsCount": 3,
  "createdAt": "2026-04-12T10:00:00Z",
  "updatedAt": "2026-05-10T12:11:00Z"
}
```

#### 6.10.4 — `PATCH /centers/:id`
**Request:** any subset of create payload.
**Response 200:** full updated resource.

#### 6.10.5 — `DELETE /centers/:id`
**Response 204**.

---

### 6.11 File Uploads (pre-signed pattern — recommended)

#### 6.11.1 — `POST /uploads/presign`
**Request**
```json
{
  "fileName": "ad-1.jpg",
  "contentType": "image/jpeg",
  "size": 1843200,
  "purpose": "advertisement"
}
```
> `purpose` ∈ `advertisement | charitable | center | avatar`.

**Response 200**
```json
{
  "uploadUrl": "https://hayai-uploads.s3.amazonaws.com/...?X-Amz-Signature=...",
  "uploadMethod": "PUT",
  "fileUrl": "https://cdn.hayai.com/advertisements/ad-1-abcd.jpg",
  "expiresIn": 900
}
```
Client then `PUT`s the binary file to `uploadUrl` and submits `fileUrl` with the resource form.

> **Alternative (simpler):** accept `multipart/form-data` on each resource's `POST`/`PATCH` (`image` field + JSON). Pick one and document; FE will adapt.

---

### 6.12 External Medical Devices (stubs — UI not implemented yet)

#### 6.12.1 — `GET /external-devices` — List
**Query:** `?page=1&pageSize=10&search=&category=&status=`
**Response 200**
```json
{
  "data": [
    {
      "id": "dev_1",
      "name": "Blood Pressure Monitor",
      "sku": "BPM-2030",
      "category": "monitoring",
      "price": 1200,
      "currency": "EGP",
      "stock": 35,
      "imageUrl": "https://cdn.hayai.com/devices/1.jpg",
      "status": "active"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

#### 6.12.2 — `POST /external-devices` — Create
**Request**
```json
{
  "name": "Blood Pressure Monitor",
  "sku": "BPM-2030",
  "category": "monitoring",
  "price": 1200,
  "currency": "EGP",
  "stock": 35,
  "imageUrl": "https://cdn.hayai.com/devices/1.jpg",
  "status": "active"
}
```
**Response 201:** same shape as 6.12.1 item.

#### 6.12.3 — `GET /external-devices/:id`, `PATCH /external-devices/:id`, `DELETE /external-devices/:id`
Standard CRUD; same shape as above. `DELETE` → 204.

#### 6.12.4 — `GET /external-device-orders` — List orders
**Query:** `?page=1&pageSize=10&status=&patientId=`
**Response 200**
```json
{
  "data": [
    {
      "id": "ord_1",
      "patient": { "id": "u_p_500", "name": "Olivia Rhye" },
      "items": [
        { "deviceId": "dev_1", "name": "Blood Pressure Monitor", "qty": 1, "price": 1200 }
      ],
      "total": 1200,
      "currency": "EGP",
      "status": "pending",
      "shippingAddress": { "line1": "5 Tahrir St", "city": "Giza", "governorate": "Giza", "phone": "01228358129" },
      "createdAt": "2026-05-20T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

#### 6.12.5 — `POST /external-device-orders` — Create (likely called from public app, not admin)
**Request**
```json
{
  "patientId": "u_p_500",
  "items": [ { "deviceId": "dev_1", "qty": 1 } ],
  "shippingAddress": { "line1": "5 Tahrir St", "city": "Giza", "governorate": "Giza", "phone": "01228358129" }
}
```
**Response 201:** same shape as a list item, with `total` computed server-side.

#### 6.12.6 — `GET /external-device-orders/:id`, `PATCH /external-device-orders/:id`
Standard read/update.

#### 6.12.7 — `PATCH /external-device-orders/:id/status`
**Request**
```json
{ "status": "shipped", "trackingNumber": "ABC-12345" }
```
> Status flow: `pending → confirmed → shipped → delivered | cancelled`.

**Response 200:** full updated order.

---

## 7. Lookup / Reference Data Endpoints

Filter dropdowns and forms reference these. Either expose them or hard-code in FE — recommend exposing so admins can manage them later.

| # | Method | Path | Purpose |
|---|---|---|---|
| 55 | GET | `/lookups/governorates` | Egyptian governorates (Patient filter & user profile). |
| 56 | GET | `/lookups/genders` | `['male','female']` (Patient & Tourist filters). |
| 57 | GET | `/lookups/doctor-roles` | Doctor "Role" filter. |
| 58 | GET | `/lookups/doctor-specialties` | Doctor specialty filter. |
| 59 | GET | `/lookups/doctor-subspecialties` | `?specialtyId=` chained. |
| 60 | GET | `/lookups/user-types` | The 12 user types for Renewal filter + Send Notifications target. |
| 61 | GET | `/lookups/plan-types` | The provider categories a plan can apply to (Hospital, Doctor, Clinic, …). |
| 62 | GET | `/lookups/transaction-statuses` | pending / in_progress / complete. |
| 63 | GET | `/lookups/listing-statuses` | active / inactive / available. |

---

## 8. Notes & Open Questions for Backend

These are explicit gaps where the FE leaves something undefined — BE owner should confirm with PM before locking the schema.

1. **Centers Services list** — Card view shows "5 Services" but the Add form has no services editor (Charitable has one). Either: (a) the BE seeds a fixed list per center category, or (b) we'll add the editor UI to the Center form soon. Assume **(b)** and expose `services: string[]` editable via `PATCH /centers/:id`.
2. **Transaction main tabs missing two types** — "Physical Therapy" and "Employment Office" are missing from the Transactions tab list. Either they don't generate transactions, or it's an oversight. Confirm — but design the BE schema so they *can* generate transactions.
3. **Provider details/edit pages** — All 12 user lists have no per-row "View / Edit" page yet (only Deactivate / Change plan / Block in the 3-dot menu). Still expose `GET /<resource>/:id` and `PATCH /<resource>/:id` since they will be added.
4. **Sign-up of providers** — The dashboard does not include creation forms for hospitals/doctors/etc. Sign-up must happen from a public marketplace app (not in this repo). The admin sees them in lists once registered — the admin's job is to **activate** (notification panel says "waiting for activation"). So:
   - `PATCH /<resource>/:id/status { status:'active' }` doubles as **approval**.
   - Newly registered providers come in with `status='pending'`.
5. **Notification "approval" links** — Each navbar notification should ideally carry a `link` field deep-linking the admin to the entity to approve (e.g. `/dashboard/hospital/<id>`). BE should generate this.
6. **Bulk actions on tables** — Every table has row checkboxes + a header checkbox, but no bulk-action button is implemented (except "Renew All Users"). PM should confirm whether bulk Deactivate / bulk Delete is needed; if yes, expose `POST /<resource>/bulk-status`, `POST /<resource>/bulk-delete`.
7. **Pagination total** — UI badge says "100 users" / "100 Transactions" hard-coded. Wire this from `meta.total`.
8. **Trend % on KPI cards** — Currently all four show `10.2%` placeholder. BE should compute against the **previous period of the same length** (e.g. selected range is Jan 1–Feb 1 → compare against Dec 2–Jan 1).
9. **Currency** — Plan price example shows `$299`, revenue shows numbers like `140,452` with no unit. Confirm whether platform is single-currency (EGP likely, given Egyptian context) or multi. Recommend EGP default but expose `currency` in responses.
10. **Plan ↔ Provider Type** — Each plan has a `type` ("Hospital"). It's unclear whether one plan can target multiple types or just one. Current cards show one type per plan — design as `planType: string` (single FK).
11. **Languages** — A `lang` toggle (EN) exists in login & navbar. Confirm with PM whether AR is needed at launch; if yes, every user-facing field on the BE that varies by language (e.g. plan name, description, charity description, service names) must support i18n. Recommend: store as `{en: "...", ar: "..."}` objects on translatable fields.
12. **Hardcoded admin name in navbar** — `Eslam mohamed` / `Eslammohamed2@Gmail.com` are static placeholders. BE just needs to make sure `/auth/me` returns `name` + `email` + `avatarUrl`.
13. **TokenService / UserService / Interceptors are empty files** — the FE will fill them in. BE should still expect `Authorization: Bearer` + standard error envelope (§3.5).
14. **Auth guard is currently commented out** in `app.routes.ts`. That's only a dev convenience — BE should still enforce auth on every protected endpoint.
15. **"Send Notifications" target audience** — Dropdown currently lists All / Doctors / Hospitals / Patients only, but logically it should expose all 14 types (12 providers + patients + tourists) and probably custom segmentation later (by plan, by governorate). Design `targetAudience` as a structured object on the API: `{ type: 'all' | 'user_type' | 'segment', userTypes?: string[], filters?: {...} }`.
16. **Edit vs Add routes share component** — In `dashboard.routes.ts`, `Advertisements/edit/:id`, `charitable/edit/:id`, `plans/edit/:id`, `dialysis/edit/:id`, etc. all load the SAME component as Add. The component must:
    - When `:id` is present: `GET /<resource>/:id` → prefill form.
    - On submit: `PATCH /<resource>/:id` (edit) or `POST /<resource>` (add).
17. **Search behavior** — Confirm search semantics: prefix match? full-text? Recommend case-insensitive substring match across `name`, `email`, `phone` for user lists; `name`, `description` for content lists.
18. **Schedule day model** — Days are always the full 7 (Sat→Fri in Arabic week order). Backend should store all 7 always, with an `active` boolean — do NOT drop days when inactive (FE expects exactly 7).

---

## Appendix A — Sample Payloads

### A.1 Login
**Request** `POST /auth/login`
```json
{ "email": "admin@hayai.com", "password": "••••••" }
```
**Response** `200`
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "9b0e...","name": "Eslam Mohamed",
    "email": "eslammohamed2@gmail.com",
    "role": "admin",
    "avatarUrl": "https://cdn.hayai.com/avatars/eslam.png"
  }
}
```

### A.2 List Patients
**Request** `GET /patients?page=1&pageSize=10&search=ol&governorate=giza&gender=female&status=active`
**Response**
```json
{
  "data": [
    {
      "id": "u_001",
      "name": "Olivia Rhye",
      "email": "olivia@untitledui.com",
      "phone": "01228358129",
      "avatarUrl": "https://...",
      "governorate": "Giza",
      "gender": "female",
      "status": "active",
      "createdAt": "2025-09-12T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 100, "totalPages": 10 }
}
```

### A.3 Create Charitable Organization
**Request** `POST /charitable-organizations`
```json
{
  "name": "Healthcare For All",
  "status": "active",
  "description": "Established in 2010 ...",
  "notes": "...",
  "coverImageUrl": "https://cdn.hayai.com/charity/abc.jpg",
  "schedule": [
    {"day":"saturday","active":true,"from":"10:00","to":"20:00"},
    {"day":"sunday","active":true,"from":"10:00","to":"20:00"},
    {"day":"monday","active":true,"from":"10:00","to":"20:00"},
    {"day":"tuesday","active":true,"from":"10:00","to":"20:00"},
    {"day":"wednesday","active":true,"from":"10:00","to":"20:00"},
    {"day":"thursday","active":true,"from":"10:00","to":"20:00"},
    {"day":"friday","active":false,"from":null,"to":null}
  ],
  "services": [
    "Free Medical Consultations",
    "Patient Transportation",
    "Child Healthcare Support",
    "Elderly Care Assistance",
    "Chronic Disease Support"
  ],
  "contacts": [
    {"title":"Hospital","phone":"01119253120"},
    {"title":"Home Care Manager (Mohamed Ali)","phone":"01119253120"},
    {"title":"Complaints","phone":"01119253120"}
  ]
}
```
**Response** `201` returns the full created resource with `id`, `createdAt`, `updatedAt`, derived counters.

### A.4 Create Plan
**Request** `POST /plans`
```json
{
  "name": "Premium",
  "type": "hospital",
  "status": "active",
  "price": 299,
  "durationMonths": 1,
  "discountPercent": 12,
  "description": "Full access to all modules",
  "modules": [
    {"id":"patient","included":true,"description":"Complete patient record management system"},
    {"id":"appointments","included":true,"description":"Schedule and manage patient appointments"},
    {"id":"analytics","included":true,"description":"Advanced analytics and reporting dashboard"},
    {"id":"billing","included":true,"description":"Integrated billing and payment processing"},
    {"id":"inventory","included":false,"description":null}
  ]
}
```

### A.5 Send Broadcast
**Request** `POST /notifications/broadcast`
```json
{
  "title": "System maintenance tonight",
  "body": "We will be down 02:00–04:00 Cairo time.",
  "targetAudience": { "type": "user_type", "userTypes": ["hospital","clinic"] }
}
```

### A.6 Transactions List
**Request** `GET /transactions?serviceType=doctor&status=pending&from=2026-04-01&to=2026-04-30&page=1&pageSize=10`
**Response**
```json
{
  "data": [
    {
      "id": "tx_1",
      "provider": { "id":"u_010","name":"Dr. Kareem Mohamed","avatarUrl":"...","type":"doctor" },
      "patient":  { "id":"u_500","name":"Olivia Rhye","avatarUrl":"...","type":"patient" },
      "serviceType": "doctor",
      "requestType": "home_visit",
      "date": "2026-04-19",
      "status": "pending",
      "createdAt": "2026-04-19T08:11:00Z"
    }
  ],
  "meta": { "page":1, "pageSize":10, "total":100, "totalPages":10 }
}
```

---

## Appendix B — Suggested DB Tables (Quick Reference)

```
users (id, type, name, email_unique, password_hash, phone, avatar_url, status, governorate, gender, created_at, updated_at)
doctor_profiles (user_id, role, specialty, subspecialty)
providers_meta (user_id, plan_id, plan_started_at, plan_ends_at, auto_renew)

plans (id, name, type, status, price, duration_months, discount_percent, description)
plan_modules (plan_id, module_id, included, description)
modules (id, name)

subscriptions (id, user_id, plan_id, started_at, ended_at, status)

charitable_organizations (id, name, status, description, notes, cover_image_url)
charitable_schedule (org_id, day, active, time_from, time_to)
charitable_services (org_id, name, position)
charitable_contacts (id, org_id, title, phone)

centers (id, category, name, status, description, notes, cover_image_url)
center_schedule (center_id, day, active, time_from, time_to)
center_services (center_id, name, position)
center_contacts (id, center_id, title, phone)

advertisements (id, redirect_link, image_url, status, created_at)

transactions (id, provider_id, patient_id, service_type, request_type, date, status, created_at)

system_notifications (id, recipient_user_id, type, title, description, link, unread, category, created_at)
broadcast_notifications (id, title, body, target_audience_json, sent_by, sent_at)
broadcast_recipients (broadcast_id, user_id, delivered_at, read_at)

uploads (id, url, purpose, uploaded_by, size, content_type, created_at)
```

---

**End of analysis.** Anything not covered in this document is either (a) static UI (icons, layout, copy) that does not require a backend or (b) explicitly flagged as an Open Question in §8 — please decide on those before sprint planning.
