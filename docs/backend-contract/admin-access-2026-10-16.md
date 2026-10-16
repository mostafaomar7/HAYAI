# Admin dashboard: role-based access + admin notifications

Backend contract (2026-10-16), as received from the backend team, with the
dashboard's implementation notes at the end. Verified against production the
same day: `admin_access` is on the login response and `/auth/me`,
`/admin/access/me`, `/admin/access/permissions`, `/admin/access/roles` and
`/admin/access/admins` answer, and bell rows carry `data`.

All paths are under `https://api.hayaihealthcare.com/api/v1`, with the usual
`{success, message, data, meta?}` envelope.

## 1. Permission model

Each dashboard area has `view` and, where there is something to change,
`manage`. **`manage` includes `view`.** `GET` needs `<area>.view`; `POST`,
`PUT`, `PATCH` and `DELETE` need `<area>.manage`.

| Area key | Area | Levels |
|---|---|---|
| `patients` | Patients & tourists | view, manage |
| `doctors` | Doctors (+ doctor specialties, clinical guidelines) | view, manage |
| `hospitals` | Hospitals & clinics | view, manage |
| `icu` | ICU lists | view, manage |
| `pharmacies` | Pharmacies, their branches, products, orders | view, manage |
| `labs` | Labs & radiology | view, manage |
| `home_care` | Home care | view, manage |
| `physical_therapy` | Physical therapy + its requests | view, manage |
| `senior_care` | Senior care | view, manage |
| `medical_tourism` | Medical tourism lists | view, manage |
| `medical_insurance` | Insurance companies, requests, limit requests, insurance directory | view, manage |
| `medical_devices` | Device companies, external devices, their orders, group orders | view, manage |
| `charities` | Charitable organizations & centers | view, manage |
| `employment` | Employment offices, jobs, job applications | view, manage |
| `subscriptions` | Plans, plan modules, renewals | view, manage |
| `advertisements` | Advertisements | view, manage |
| `notifications` | Broadcasts | view, manage |
| `support` | Reports & support tickets | view, manage |
| `account_deletion` | Account deletion requests | view, manage |
| `statistics` | Analytics | view |
| `ai` | AI assistant admin | view, manage |
| `platform_settings` | Platform settings, vaccine lists | view, manage |
| `audit_log` | Audit log | view |

The website CMS keeps its own permissions (`cms.view`, `leads.view`, …). A
role can carry both kinds. **`super-admin`** can do everything and is the only
role that manages admin accounts and roles. Every admin that existed before
the release was made `super-admin`.

Preset roles: `providers-manager`, `customer-service`,
`subscriptions-manager`, `read-only`, plus the website presets
(`content-editor`, `publisher`, `seo-manager`, `sales-manager`, `analyst`).

## 2. The signed-in admin's access

Login and `GET /auth/me` carry `admin_access`:

```json
"admin_access": {
  "is_super_admin": false,
  "roles": ["providers-manager"],
  "permissions": ["doctors.view", "doctors.manage", "pharmacies.view", "pharmacies.manage", "subscriptions.view"],
  "website_permissions": [],
  "areas": {
    "patients":      {"view": false, "manage": false},
    "pharmacies":    {"view": true,  "manage": true},
    "subscriptions": {"view": true,  "manage": false}
  }
}
```

`areas` has every area key. `GET /admin/access/me` returns the same plus
`id`, `name`, `email`, `must_change_password`; any admin may call it. A role
change takes effect on the admin's next request.

## 3. 403

```json
HTTP 403
{ "success": false, "message": "You do not have permission to do this.",
  "error_code": "ADMIN_PERMISSION_DENIED", "required_permission": "pharmacies.manage" }
```

`required_permission` is `super-admin` on super-admin-only routes. Website CMS
routes keep `WEBSITE_PERMISSION_DENIED`. Never a logout; 401 still is.

## 4. Shared endpoints

| Endpoint | Rule |
|---|---|
| `organizations/{id}` (show, approve, reject, block) | Area from the organization's type. |
| `facilities/{id}/*` | hospital/clinic → `hospitals`; senior care → `senior_care`. |
| `organizations/pending`, `facilities/pending` | With `?org_type=` / `?type=`: that type's `view`. Without a filter a non-super-admin needs `view` on every type, else 403. |
| `users/{id}` (DELETE), `users/{id}/reset-password`, `patients/{id}/reset-password` | `manage` on the account type's area. |
| `users/{id}/activity`, `…/summary` | `view` on the account type's area. |
| `activity/{type}/{id}` | `view` on the record's area. |
| `users/pending-counts` | Any admin; types the admin can't view count `0`, items carry `visible`. |
| `support/inbox-summary` | Any admin; inboxes the admin can't view count `0`. |
| `notifications/system/*` (the bell) | Any admin. |

## 5. Admin accounts (super-admin)

| Method | Path | Body |
|---|---|---|
| GET | `/admin/access/admins` | `?search=&status=active\|blocked&role=&per_page=` |
| POST | `/admin/access/admins` | `{name, email, phone?, language? (en\|ar), roles: [..]}` (at least one role) |
| GET | `/admin/access/admins/{id}` | |
| PATCH | `/admin/access/admins/{id}` | `{name?, email?, phone?, language?}` |
| PUT | `/admin/access/admins/{id}/roles` | `{roles: [..]}` (replaces) |
| POST | `/admin/access/admins/{id}/deactivate` | |
| POST | `/admin/access/admins/{id}/reactivate` | |
| POST | `/admin/access/admins/{id}/reset-password` | |
| POST | `/admin/access/admins/{id}/resend-invitation` | |

Create (201) returns `{admin, temporary_password, invitation_sent,
invitation_email_status: sent|failed|not_configured, invitation_error}`. The
password is never returned again. Resend issues a new temporary password and
only works while `must_change_password` is true. Reset returns `{admin,
password, must_change_password: true, sessions_revoked: true}`.

Refused with 422: changing your own roles or deactivating yourself; removing
or deactivating the last active super-admin; resetting a super-admin's
password (server only: `php artisan admin:reset-password`). No delete —
deactivate keeps the audit trail and signs the admin out everywhere.

## 6. Roles (super-admin)

| Method | Path | Body |
|---|---|---|
| GET | `/admin/access/permissions` | catalog |
| GET | `/admin/access/roles` | |
| POST | `/admin/access/roles` | `{name, permissions: [..]}` |
| GET | `/admin/access/roles/{id}` | |
| PUT/PATCH | `/admin/access/roles/{id}` | `{name?, permissions?}` (replaces) |
| DELETE | `/admin/access/roles/{id}` | |

Catalog: `{dashboard: [{area, label, label_ar, permissions}], website:
{cms: [...], leads: [...]}, all: [...], implies: {...}}`. Role: `{id, name,
is_super_admin, is_system, permissions, website_permissions, admins_count}`.
Names are lowercase with hyphens; `super-admin` can't be edited or deleted; a
role still held can't be deleted (422).

Measured on production: a role's `permissions` holds what was saved, so a
`manage` usually appears **without** its `view` (`"patients.manage"` alone).
The editor treats manage as ticking view.

## 7. `must_change_password`

A new or reset admin signs in with a temporary password; login and `/auth/me`
carry `must_change_password: true`. `POST /auth/change-password` with
`{current_password, new_password, new_password_confirmation}` clears it and
signs out the admin's other sessions.

## 8. Admin notifications

Admin alerts go to the admins who can **view** the alert's area, plus every
super-admin. New type `admin_transaction_created` (category `userActivity`):

| `data.record_type` | Area |
|---|---|
| `doctor_request` | doctors |
| `icu_request` | icu |
| `hospital_request`, `blood_request`, `transportation_request` | hospitals |
| `lab_request`, `lab_order` | labs |
| `pharmacy_order` | pharmacies |
| `device_order` | medical_devices |
| `home_care_request` | home_care |
| `physical_therapy_request` | physical_therapy |
| `insurance_request`, `insurance_limit_request` | medical_insurance |
| `medical_tourism_request` | medical_tourism |
| `employee_office_booking`, `job_application` | employment |

Every admin alert's `data` now has `permission` and `dashboard_path`
(`/dashboard/activity/pharmacy_order/12`, `/dashboard/reports/4`,
`/dashboard/website/leads/8`, …). Each type can be switched off in
`/admin/settings`, group `admin_alerts`, keys `admin_alerts.<type>` (bool,
default true).

## 9. Browser push

The backend pushes every admin alert over FCM to each registered token.
`POST /notifications/device-token {token, platform: "web"}` after login;
`DELETE /notifications/device-token {token}` on logout. Service worker at
`/firebase-messaging-sw.js`. CSP needs
`https://fcmregistrations.googleapis.com` and
`https://firebaseinstallations.googleapis.com` in `connect-src`. Permission
must be asked from a click. iOS only with the dashboard on the home screen.

## 10. Behaviour changes

1. Admins without a role are denied everywhere except `access/me`, their bell
   and the badge counts.
2. The website role screens (`/admin/website/permissions|roles|admins`, roles
   CRUD, `PUT /admin/website/admins/{id}/roles`) are super-admin only.

---

## Dashboard implementation (2026-10-16)

- `core/services/admin-access.service.ts` — `can(area, level)`,
  `canWebsite()`, the dashboard route → area table (`areaForUrl`), and
  `refresh()` from `/admin/access/me`. An account with no `admin_access`
  (a backend from before the release) reads as super-admin.
- `core/guards/admin-area.guard.ts` — on every dashboard route: holds an admin
  with `must_change_password` on change-password, and sends a screen outside
  the admin's areas to `/dashboard/no-access`.
- Sidebar entries carry `area`; the **Admins & roles** section is super-admin
  only. The old Website → Roles page is retired; `website/roles` redirects to
  Access → Roles, which edits website permissions too.
- `shared/directives/can-manage.directive.ts` — `*appCanManage` hides write
  buttons on screens the admin can view but not manage.
- `errorInterceptor` — 403 `ADMIN_PERMISSION_DENIED` shows one toast and
  re-reads the admin's access. 401 is still the only sign-out.
- Home shows no charts without `statistics.view`.
- Bell: `notificationTarget(link, data.dashboard_path)` follows the backend's
  route first.
- Settings: the `admin_alerts` rows appear on their own (the screen is built
  from the API); the group and its 16 keys are translated.
- Browser push: `core/services/push.service.ts`, the "Turn on notifications"
  item in the user menu, and `public/firebase-messaging-sw.js` (bundled from
  `scripts/push-sw/` by `npm run build:push-sw`, Firebase included, so no
  third-party script origin). The Firebase web config and VAPID key come from
  the server's `FIREBASE_WEB_CONFIG` env var; until it is set the dashboard
  does not offer notifications.
