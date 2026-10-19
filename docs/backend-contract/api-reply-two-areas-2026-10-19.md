# Reply — `clinical_guidelines` and `external_devices` (2026-10-19)

Built and on `main`. Three things, then one question.

## 1. The status line was right this time

Checked before building, because two of the last four prompts were marked
not-live and were live. This one is the other way round and accurate:

```
GET /admin/access/me   →  23 areas
   clinical_guidelines    ABSENT
   external_devices       ABSENT
   medical_devices        {view, manage}
   doctors                {view, manage}
```

So nothing of this is live yet, exactly as you said. Thank you — knowing the
status line can be trusted saves us a round of measuring each time.

## 2. Shipping the map on its own would have locked people out

Worth telling you because it is a property of the split itself, not of our
code.

An area the server has not shipped is **absent** from `areas`, not present and
false. Our `can()` read an absent key as denied — correctly, for an unknown
area. So between our release and yours, every non-super-admin would have lost
Clinical guidelines and Group orders entirely: gone from the sidebar, and
`/no-access` on a direct link. Super-admins would have seen nothing wrong,
which is the worst shape for this kind of bug.

We handled it on our side: an unknown new key falls back to the area it was
split from — `clinical_guidelines` → `doctors`, `external_devices` →
`medical_devices` — which is exactly the grant you describe under "Nobody
loses access". The fallback is never reached once `areas` carries the keys, so
your deploy turns it into dead code rather than something to undo.

**Nothing needed from you.** If you ever split another area, the same hole
opens for whoever ships first, so it may be worth returning the new key from
the start with the inherited value, rather than adding it at deploy time.

## 3. One naming trap, and which side we believed

Our i18n keys say the opposite of the words they render:

| key | renders as |
|---|---|
| `menu.external_devices` | **Internal** Medical Devices |
| `menu.external_devices_section` | **External** Medical Devices |

That is a legacy spelling we have carried for a while. Your instruction says
"Show *External medical devices* when `can('external_devices')`", and your
route list says `group-orders*`. We mapped by **route**, so:

- `group-orders*` → `external_devices` — the section headed "External Medical
  Devices". Four sidebar entries: overview, devices, categories, shipping
  companies.
- `internal-devices/*` → stays `medical_devices` — the section headed
  "Internal Medical Devices".
- `external/*` → stays `medical_devices`. Despite the name it redirects to
  `internal-devices/*`; it is the legacy path for the internal marketplace and
  is kept only for old links.
- `medical-devices` (the device-company accounts under Users) → stays
  `medical_devices`.

If you meant anything different by "External medical devices", this is the one
place to correct us.

## 4. What we tested

With a stubbed limited admin — the responses to `/auth/me` and
`/admin/access/me` rewritten in the browser, nothing touched on the server:

| Pretended access | Result |
|---|---|
| `doctors` + `medical_devices`, no new keys (today's server) | both sections visible and openable — nobody loses access |
| both new areas denied | both gone from the sidebar, `/no-access` on a direct link, Internal devices unaffected |
| the two new areas only | exactly those two; Internal devices blocked; the Users section gone — a group-orders-only admin, which is the point of the feature |
| `external_devices` view without manage | "+ Add Device" absent; with `manage`, present |

Bell alerts need nothing from us: the dashboard does not map alert types to
areas, it shows what you send.

## The question

**Does `clinical_guidelines` cover the doctor-facing guideline screens only,
or the records under `records/` too?** We moved exactly the three routes you
listed (`lists/clinical-guidelines`, `/new`, `/:id/edit`) and left everything
else on `doctors`. If any other screen reads
`/admin/doctor/clinical-guidelines*`, it will now 403 for an admin who has
`doctors` but not the new area, and we would not see it until someone hits it.

Still open from before, unchanged:
[`api-reply-senior-care-2026-10-18.md`](api-reply-senior-care-2026-10-18.md) —
whether a hospital or senior-care home can be rated, the hash for the public
picker, and plan 74.
