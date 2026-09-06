import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, PagedResult } from './api.service';
import { environment } from '../../../environments/environment';

/**
 * Admin client for the External Medical Devices group-order module.
 *
 * Deliberately separate from `ExternalDevicesService`, which is the legacy
 * marketplace (flat `/admin/external-devices` CRUD, plus `/admin/external-device-orders`
 * with payment status and shipment tracking). The two share a base path but
 * nothing else: this module explicitly holds no financial instrument, because
 * HAYAI's role ends at connecting users with the import company. Merging them
 * would put two contradictory group-purchase flows behind one screen.
 */

const ADMIN = '/admin/external-devices';

/**
 * Delivery is stored as a week range, not the label the mock-up shows: the API
 * takes delivery_weeks_min / delivery_weeks_max and renders estimated_delivery
 * ("8 - 10 Weeks") from them. Sending the label instead stores nothing, silently.
 */
export interface DeliveryWindow { min: number; max: number; }
export const DELIVERY_WINDOWS: DeliveryWindow[] = [
  { min: 4, max: 6 }, { min: 6, max: 8 }, { min: 8, max: 10 },
  { min: 10, max: 12 }, { min: 12, max: 16 }
];
export const deliveryLabel = (w: DeliveryWindow): string =>
  w.min + ' \u2013 ' + w.max + ' Weeks';

/** Order of the pipeline, and the order the status legend is drawn in. */
export const GROUP_ORDER_STATUSES = [
  'draft',
  'in_progress',
  'completed',
  'cost_pending',
  'approval_pending',
  'all_approved',
  'ready',
  'closed',
  'cancelled',
  'expired'
] as const;
export type GroupOrderStatus = (typeof GROUP_ORDER_STATUSES)[number];

/** Where a participant stands in the round itself. */
export type MembershipStatus = 'pending' | 'joined' | 'rejected' | 'removed' | 'left';

/** Where a participant stands on the quote they were sent. */
export type CostDecision = 'awaiting' | 'approved' | 'rejected';

/**
 * A field description from the category's `spec_schema`. The backend keeps the
 * per-category template server-side precisely so a new category is a row rather
 * than a release, so the form is built from this at runtime — never hardcoded.
 */
export interface SpecField {
  key: string;
  /** Resolved per Accept-Language on read. The write side uses label_en/label_ar,
   *  and label_en is required — sending `label` fails validation. */
  label: string;
  label_en?: string | null;
  label_ar?: string | null;
  sort_order?: number;
  unit?: string | null;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: string[] | null;
  required?: boolean;
  placeholder?: string | null;
}

export interface DeviceCategory {
  id: number;
  name: string;
  name_en?: string | null;
  name_ar?: string | null;
  slug: string;
  spec_schema: SpecField[] | null;
  devices_count?: number;
  is_active?: boolean;
}

export interface DeviceMedia {
  id: number;
  url: string;
  disk?: string;
  is_cover?: boolean;
  sort_order?: number;
}

export interface ResolvedSpecification {
  id?: number;
  key: string;
  label: string;
  value: string | number | null;
  unit: string | null;
}

export interface ShippingCompany {
  id: number;
  name: string;
  contact_person: string | null;
  /** `phone`, not `contact_phone` — the latter is dropped silently on write. */
  phone: string | null;
  email: string | null;
  notes?: string | null;
  is_active?: boolean;
}

/** The catalogue entry. Carries no price: a price belongs to a round, not a device. */
export interface ExternalDeviceEntry {
  id: number;
  name: string;
  name_en?: string | null;
  name_ar?: string | null;
  category_id: number | null;
  category?: DeviceCategory | null;
  uuid?: string;
  /** `brand_model` on the wire; `brand` is not a field the API knows. */
  brand_model: string | null;
  manufacturer: string | null;
  country_of_origin: string | null;
  made_in: string | null;
  /** Resolved on read; write short_description_en / short_description_ar. */
  short_description: string | null;
  short_description_en?: string | null;
  short_description_ar?: string | null;
  cover_image_url: string | null;
  images?: DeviceMedia[];
  specifications?: ResolvedSpecification[];
  status?: 'draft' | 'published' | 'archived';
  status_label?: string;
  /** The round currently running for this device, when there is one. */
  active_group_order?: GroupOrderSummary | null;
  group_orders_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CostBreakdown {
  revision_no?: number;
  currency: string;
  total_cost: number | string | null;
  cost_per_person: number | string | null;
  /** Only meaningful once an FX rate is configured; stays indicative either way. */
  local_currency?: string | null;
  fx_rate?: number | string | null;
  sent_at?: string | null;
  approval_deadline?: string | null;
  notes?: string | null;
}

export interface GroupOrderDeviceRef {
  id: number;
  name: string;
  name_en?: string | null;
  name_ar?: string | null;
  cover_image_url: string | null;
}

export interface GroupOrderSummary {
  id: number;
  uuid?: string;
  device_id: number;
  /** Nested object on the wire; there is no flat `device_name`. */
  device?: GroupOrderDeviceRef | null;
  round_number: number;
  status: GroupOrderStatus;
  /** Bilingual sibling added by the response walker per Accept-Language. */
  status_label?: string;
  /** The target. Named `group_size`, not `target_size`. */
  group_size: number;
  /** Confirmed units — what completes the round and what the total is divided by. */
  joined: number;
  /** Units held by requests still awaiting review. Blocks a newcomer, but does
   *  not complete the round and does not enter the price division. */
  pending_review: number;
  remaining: number;
  progress?: number;
  accepts_joins?: boolean;
  join_deadline?: string | null;
  estimated_delivery?: string | null;
  delivery_weeks_min?: number | null;
  delivery_weeks_max?: number | null;
  max_quantity_per_user?: number;
  created_at?: string;
  published_at?: string | null;
}

export interface GroupOrderParticipant {
  id: number;
  user_id: number;
  user_name: string;
  phone: string | null;
  email?: string | null;
  quantity: number;
  membership_status: MembershipStatus;
  membership_status_label?: string;
  cost_decision?: CostDecision | null;
  cost_decision_label?: string;
  user?: { id: number; name: string; phone: string | null; email?: string | null } | null;
  /** Snapshotted when the quote was sent, so a later re-quote cannot rewrite history. */
  share_amount?: number | string | null;
  request_date: string;
  reviewed_at?: string | null;
  /** Consent to hand the phone number to the importer. Precondition for approval. */
  terms_accepted_at?: string | null;
  contact_shared_at?: string | null;
  reject_reason?: string | null;
}

/** One row of `activity_log`. Not every entry is a status change — a reminder or
 *  a participant decision lands here too, with from/to left null. */
export interface ActivityEntry {
  id: number;
  event: string;
  from_status: GroupOrderStatus | null;
  to_status: GroupOrderStatus | null;
  to_status_label?: string;
  actor_type?: string | null;
  actor_name?: string | null;
  participant_id?: number | null;
  /** The free-text reason. Named `note`, not `reason`. */
  note?: string | null;
  created_at: string;
}

export interface GroupOrderDetail extends GroupOrderSummary {
  notes_for_users?: string | null;
  cost?: CostBreakdown | null;
  cost_revisions?: CostBreakdown[];
  /** Top level, not nested inside `cost`. */
  shipping_company?: ShippingCompany | null;
  approvals?: ApprovalTally;
  participants?: GroupOrderParticipant[];
  activity_log?: ActivityEntry[];
  seat_reopen_deadline?: string | null;
  completed_at?: string | null;
  all_approved_at?: string | null;
  ready_at?: string | null;
  closed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

/** Screen 14 — the tally the progress bar and reminder button read from. */
export interface ApprovalTally {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  percent: number;
  pending_review?: number;
  pending_review_requests?: number;
  deadline?: string | null;
}

/** The endpoint wraps the tally; it does not return it flat. */
export interface ApprovalSummary {
  summary: ApprovalTally;
  participants?: GroupOrderParticipant[];
}

/** Screen 1 — the four tiles plus the overview table beneath them.
 *  The counters sit under `stats`; they are not flat on `data`. */
export interface GroupOrderStats {
  total_devices: number;
  active_group_orders: number;
  completed_orders: number;
  pending_requests: number;
}

export interface GroupOrderDashboard {
  stats: GroupOrderStats;
  group_orders?: GroupOrderSummary[];
}

export interface CostPayload {
  total_cost: number;
  delivery_weeks_min: number;
  delivery_weeks_max: number;
  /**
   * Required. The API will not take an ad-hoc importer on the quote — the
   * partner has to exist first, so the cost form points at the partners screen
   * rather than offering free-text fields that could never save.
   */
  shipping_company_id: number;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeviceGroupOrdersService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // ------------------------------------------------------------------ screen 1
  dashboard(): Observable<GroupOrderDashboard> {
    return this.api.get<GroupOrderDashboard>(`${ADMIN}/dashboard`);
  }

  // ----------------------------------------------------------------- categories
  categories(params?: Record<string, unknown>): Observable<PagedResult<DeviceCategory>> {
    return this.api.getPaged<DeviceCategory>(`${ADMIN}/categories`, params);
  }

  category(id: number): Observable<DeviceCategory> {
    return this.api.get<DeviceCategory>(`${ADMIN}/categories/${id}`);
  }

  createCategory(body: Partial<DeviceCategory>): Observable<DeviceCategory> {
    return this.api.post<DeviceCategory>(`${ADMIN}/categories`, body);
  }

  updateCategory(id: number, body: Partial<DeviceCategory>): Observable<DeviceCategory> {
    return this.api.put<DeviceCategory>(`${ADMIN}/categories/${id}`, body);
  }

  deleteCategory(id: number): Observable<void> {
    return this.api.delete<void>(`${ADMIN}/categories/${id}`);
  }

  // ---------------------------------------------------------- shipping partners
  shippingCompanies(params?: Record<string, unknown>): Observable<PagedResult<ShippingCompany>> {
    return this.api.getPaged<ShippingCompany>(`${ADMIN}/shipping-companies`, params);
  }

  createShippingCompany(body: Partial<ShippingCompany>): Observable<ShippingCompany> {
    return this.api.post<ShippingCompany>(`${ADMIN}/shipping-companies`, body);
  }

  updateShippingCompany(id: number, body: Partial<ShippingCompany>): Observable<ShippingCompany> {
    return this.api.put<ShippingCompany>(`${ADMIN}/shipping-companies/${id}`, body);
  }

  deleteShippingCompany(id: number): Observable<void> {
    return this.api.delete<void>(`${ADMIN}/shipping-companies/${id}`);
  }

  // -------------------------------------------------------------- screens 2-5
  devices(params?: Record<string, unknown>): Observable<PagedResult<ExternalDeviceEntry>> {
    return this.api.getPaged<ExternalDeviceEntry>(`${ADMIN}/devices`, params);
  }

  device(id: number): Observable<ExternalDeviceEntry> {
    return this.api.get<ExternalDeviceEntry>(`${ADMIN}/devices/${id}`);
  }

  /** Step 1 of the wizard. Multipart because the cover image is part of it. */
  createDevice(form: FormData): Observable<ExternalDeviceEntry> {
    return this.api.postMultipart<ExternalDeviceEntry>(`${ADMIN}/devices`, form);
  }

  /** POST rather than PUT: Laravel does not populate `$request->all()` from a
   *  multipart PUT body, so an update carrying a file has to be spoofed. */
  updateDevice(id: number, form: FormData): Observable<ExternalDeviceEntry> {
    form.append('_method', 'PUT');
    return this.api.postMultipart<ExternalDeviceEntry>(`${ADMIN}/devices/${id}`, form);
  }

  /**
   * Step 2 of the wizard — values resolved against the category's spec_schema.
   * Every value is validated as a string server-side, so a numeric field is
   * stringified here rather than at each call site: sending 1500 instead of
   * "1500" fails the whole request.
   */
  saveSpecifications(
    id: number,
    specifications: { key: string; value: string | number | null }[]
  ): Observable<ExternalDeviceEntry> {
    return this.api.put<ExternalDeviceEntry>(`${ADMIN}/devices/${id}/specifications`, {
      specifications: specifications.map(sp => ({
        key: sp.key,
        value: sp.value === null || sp.value === '' ? null : String(sp.value)
      }))
    });
  }

  addMedia(id: number, form: FormData): Observable<DeviceMedia[]> {
    return this.api.postMultipart<DeviceMedia[]>(`${ADMIN}/devices/${id}/media`, form);
  }

  deleteMedia(id: number, mediaId: number): Observable<void> {
    return this.api.delete<void>(`${ADMIN}/devices/${id}/media/${mediaId}`);
  }

  deleteDevice(id: number): Observable<void> {
    return this.api.delete<void>(`${ADMIN}/devices/${id}`);
  }

  /** Step 3 of the wizard. A round is its own record, so the same device can be
   *  ordered again once this one completes. */
  /**
   * The request field is `target_size`; the response calls the same number
   * `group_size`. Sending `group_size` fails with "The target size field is
   * required", so the asymmetry is deliberate on the wire and kept explicit here.
   */
  openGroupOrder(
    deviceId: number,
    body: {
      target_size: number;
      delivery_weeks_min: number;
      delivery_weeks_max: number;
      join_deadline: string;
      notes_for_users?: string | null;
    }
  ): Observable<GroupOrderDetail> {
    return this.api.post<GroupOrderDetail>(`${ADMIN}/devices/${deviceId}/group-orders`, body);
  }

  // ------------------------------------------------------------- screens 6-16
  groupOrders(params?: Record<string, unknown>): Observable<PagedResult<GroupOrderSummary>> {
    return this.api.getPaged<GroupOrderSummary>(`${ADMIN}/group-orders`, params);
  }

  groupOrder(id: number): Observable<GroupOrderDetail> {
    return this.api.get<GroupOrderDetail>(`${ADMIN}/group-orders/${id}`);
  }

  approvals(id: number): Observable<ApprovalSummary> {
    return this.api.get<ApprovalSummary>(`${ADMIN}/group-orders/${id}/approvals`);
  }

  /** Screens 10 and 11 — one call both records the quote and sends it out. */
  submitCost(id: number, body: CostPayload): Observable<GroupOrderDetail> {
    return this.api.post<GroupOrderDetail>(`${ADMIN}/group-orders/${id}/cost`, body);
  }

  approveParticipant(id: number, participantId: number): Observable<GroupOrderParticipant> {
    return this.api.post<GroupOrderParticipant>(
      `${ADMIN}/group-orders/${id}/participants/${participantId}/approve`
    );
  }

  rejectParticipant(id: number, participantId: number, reason: string): Observable<GroupOrderParticipant> {
    return this.api.post<GroupOrderParticipant>(
      `${ADMIN}/group-orders/${id}/participants/${participantId}/reject`,
      { reason }
    );
  }

  removeParticipant(id: number, participantId: number, reason: string): Observable<GroupOrderParticipant> {
    return this.api.post<GroupOrderParticipant>(
      `${ADMIN}/group-orders/${id}/participants/${participantId}/remove`,
      { reason }
    );
  }

  sendReminder(id: number): Observable<ApprovalSummary> {
    return this.api.post<ApprovalSummary>(`${ADMIN}/group-orders/${id}/reminders`);
  }

  /** Screens 15-16 — the handover, and the end of HAYAI's involvement. */
  shareContacts(id: number): Observable<GroupOrderDetail> {
    return this.api.post<GroupOrderDetail>(`${ADMIN}/group-orders/${id}/share-contacts`);
  }

  close(id: number): Observable<GroupOrderDetail> {
    return this.api.post<GroupOrderDetail>(`${ADMIN}/group-orders/${id}/close`);
  }

  cancel(id: number, reason: string): Observable<GroupOrderDetail> {
    return this.api.post<GroupOrderDetail>(`${ADMIN}/group-orders/${id}/cancel`, { reason });
  }

  /**
   * CSV of the participant list. Goes through HttpClient directly: ApiService
   * unwraps a JSON envelope, and this endpoint streams a file. The BOM the
   * backend writes is what makes Excel read the Arabic names correctly, so the
   * bytes are passed through untouched.
   */
  exportParticipants(id: number): Observable<Blob> {
    const base = environment.apiBaseUrl.replace(/\/+$/, '');
    return this.http
      .get(`${base}${ADMIN}/group-orders/${id}/export`, { responseType: 'blob', observe: 'response' })
      .pipe(map(r => r.body as Blob));
  }
}
