import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

export interface ExternalDevice {
  id: number;
  name: string;
  slug: string;
  source: 'internal' | 'external';
  company_id: number | null;
  brand: string | null;
  cover_image: string | null;
  price: number | string;
  currency: string;
  is_available: boolean;
  description: string | null;
  rating_avg: number;
  rating_count: number;
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

  listOrders(query: { page?: number; per_page?: number; status?: string; user_id?: number } = {}): Observable<PagedResult<ExternalDeviceOrder>> {
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
