import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export interface DeviceCompany {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface ExternalDevice {
  id: number;
  name: string;
  slug: string;
  source: 'internal' | 'external';
  company_id: number | null;
  owner_facility_id: number | null;
  brand: string | null;
  cover_image_url: string | null;
  price: number | string;
  /** Pre-discount price when the device is on offer. */
  original_price: number | string | null;
  currency: string;
  /** Per-unit price once the group buy reaches its minimum. */
  group_price: number | string | null;
  is_available: boolean;
  group_purchase_enabled: boolean;
  group_purchase_min_slots: number | null;
  description: string | null;
  rating_avg: number;
  rating_count: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  company: DeviceCompany | null;
  created_at: string;
  updated_at: string;
}

/**
 * A buyer's place in a group-buying round, as it stands right now.
 *
 * Null for an internal device, and null for an external one with no round
 * open — a round is a thing that starts and closes, not a property of the
 * device.
 */
export interface GroupRound {
  round_id: number;
  round_number: number;
  status: string;
  target_size: number;
  joined_count: number;
  reserved_count: number;
  seats_remaining: number;
  progress_percent: number;
  join_deadline: string | null;
  joinable: boolean;
  /** Where THIS order's buyer sits in the round — "#3 of 10". */
  my_membership: {
    status: string;
    quantity: number;
    position: number;
  } | null;
}

export interface ExternalDeviceOrder {
  id: number;
  device_id: number;
  transaction_id: number;
  group_purchase_id: number | null;
  purchase_type: 'solo' | 'group';
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_reference: string | null;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  status_label?: string;
  purchase_type_label?: string;
  payment_status_label?: string;
  device?: { id: number; name: string; brand?: string | null; cover_image_url?: string | null } | null;
  product_name?: string | null;
  product_image?: string | null;
  brand?: string | null;
  /** `external` = a dashboard device the admin fulfils. `internal` = in-app. */
  device_source?: 'external' | 'internal' | null;
  price_pending?: boolean;
  group_round?: GroupRound | null;
  delivery_fee?: number | string | null;
  grand_total?: number | string | null;
  /** What the buyer wrote, and what the seller wrote back. */
  owner_note?: string | null;
  cancellation_reason?: string | null;
  needed_at?: string | null;
  tracking_number: string | null;
  estimated_delivery_days: number | null;
  address: {
    line: string | null;
    city: string | null;
    governorate: string | null;
    postal_code: string | null;
  } | null;
  contact: {
    name: string;
    phone: string;
    contact_phone?: string | null;
    account_phone?: string | null;
  } | null;
  notes: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ExternalDevicesService {
  private api = inject(ApiService);

  listDevices(query: { page?: number; per_page?: number; search?: string; status?: string; source?: string } = {}): Observable<PagedResult<ExternalDevice>> {
    return this.api.getPaged<ExternalDevice>('/admin/external-devices', query);
  }

  getDevice(id: number): Observable<ExternalDevice> {
    return this.api.get<ExternalDevice>(`/admin/external-devices/${id}`);
  }

  createDevice(form: FormData): Observable<ExternalDevice> {
    return this.api.postMultipart<ExternalDevice>('/admin/external-devices', form);
  }

  updateDevice(id: number, body: Partial<ExternalDevice>): Observable<ExternalDevice> {
    return this.api.put<ExternalDevice>(`/admin/external-devices/${id}`, body);
  }

  updateDeviceMultipart(id: number, form: FormData): Observable<ExternalDevice> {
    return this.api.postMultipart<ExternalDevice>(`/admin/external-devices/${id}`, form);
  }

  deleteDevice(id: number): Observable<void> {
    return this.api.delete<void>(`/admin/external-devices/${id}`);
  }

  listOrders(
    query: { page?: number; per_page?: number; status?: string; user_id?: number; source?: 'external' | 'internal' } = {}
  ): Observable<PagedResult<ExternalDeviceOrder>> {
    return this.api.getPaged<ExternalDeviceOrder>('/admin/external-device-orders', query);
  }

  getOrder(id: number): Observable<ExternalDeviceOrder> {
    return this.api.get<ExternalDeviceOrder>(`/admin/external-device-orders/${id}`);
  }

  setOrderStatus(
    id: number,
    body: { status: string; tracking_number?: string }
  ): Observable<ExternalDeviceOrder> {
    return this.api.patch<ExternalDeviceOrder>(`/admin/external-device-orders/${id}/status`, body);
  }
}
