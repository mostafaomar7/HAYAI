# Internal vs External medical devices — dashboard changes (2026-10-29)

From the backend prompt of 2026-10-29 (backend ready, live with its next deploy).
Internal = company-owned marketplace (`/admin/external-devices` with no sub-path,
`/admin/external-device-orders`, area `medical_devices`). External = HAYAI's
imported devices sold by group order (`/admin/external-devices/{dashboard,devices,
categories,shipping-companies,group-orders}`, area `external_devices`).

## Done in the dashboard

- **Wizard step 3** opens the round with `publish: true`, so the device reaches
  the app with its group open.
- **Wizard step 2** sends each value with `label_en`, `label_ar`, `unit` and
  `sort_order` from the category's `spec_schema`.
- **Wizard step 1** can attach more photos (`images[]`) besides the cover.
- **Cost form**: the "Notes for users" box was sent as `notes`, which the cost
  endpoint does not read. It now goes as `notes_for_users`, and a separate
  "Shipping notes" box sends `ship_notes`.
- **Round details**: the Pending tab and the Approve / Reject buttons are gone
  (a join counts at once). Remove stays. New **Order number** column
  (`order_number`, e.g. `GO-10-27`).
- **Overview** has an **Add device** button (the devices list already had one).
- **Bell**: `/admin/external-devices/group-orders/{id}` maps to
  `/dashboard/group-orders/{id}` when an alert has no `dashboard_path`.
- **Internal orders**: the All / External / Internal source tabs are removed;
  the endpoint now returns internal orders only.
- Already correct before this change: the internal devices list asks for
  `source=internal`; the External section only calls the sub-path endpoints;
  editing the group size uses `PATCH /group-orders/{id}`; cost, approvals,
  reminders, share-contacts and export each use their own endpoint.

## Not applicable

- "Internal Add device requires a company": the dashboard has no form for
  adding an internal device. Companies add their own from the partner app.
