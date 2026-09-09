import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * The six record lists the backend exposed alongside the unified record
 * endpoint. They are six different tables with six different column sets, so
 * they are described here and rendered by one screen — the same shape the
 * option lists already use.
 *
 * A row opens at `/dashboard/activity/{recordType}/{id}`, which is why no list
 * needs a detail screen of its own.
 */
export type RecordListKey =
  | 'pharmacy-orders'
  | 'physical-therapy-requests'
  | 'insurance-requests'
  | 'insurance-limit-requests'
  | 'jobs'
  | 'job-applications';

export type ColumnKind = 'text' | 'money' | 'date' | 'datetime' | 'bool' | 'status';

export interface RecordColumn {
  labelKey: string;
  /** Dotted path into the row — `user.name` reads the nested object. */
  path: string;
  kind?: ColumnKind;
  /** `money` only: where the currency for this figure lives. */
  currencyPath?: string;
}

export interface RecordListConfig {
  key: RecordListKey;
  base: string;
  titleKey: string;
  /** The activity record type a row resolves to when opened. */
  recordType: string;
  columns: RecordColumn[];
}

/**
 * Column choices follow what the row actually carries — measured against the
 * deployed API rather than taken from a schema. `applicant_type` is left out on
 * purpose: it arrives as a PHP class name, which is not something to show.
 */
export const RECORD_LISTS: Record<RecordListKey, RecordListConfig> = {
  'pharmacy-orders': {
    key: 'pharmacy-orders',
    base: '/admin/pharmacy-orders',
    titleKey: 'records.pharmacy_orders',
    recordType: 'pharmacy_order',
    columns: [
      { labelKey: 'records.col.customer', path: 'customer' },
      { labelKey: 'records.col.pharmacy', path: 'pharmacy.name' },
      { labelKey: 'records.col.total', path: 'total_amount', kind: 'money', currencyPath: 'currency' },
      { labelKey: 'records.col.payment', path: 'payment_status_label' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' },
      { labelKey: 'records.col.created', path: 'created_at', kind: 'datetime' }
    ]
  },
  'physical-therapy-requests': {
    key: 'physical-therapy-requests',
    base: '/admin/physical-therapy-requests',
    titleKey: 'records.therapy_requests',
    recordType: 'physical_therapy_request',
    columns: [
      { labelKey: 'records.col.requester', path: 'user.name' },
      { labelKey: 'records.col.center', path: 'center.name' },
      { labelKey: 'records.col.requested_date', path: 'requested_date', kind: 'date' },
      { labelKey: 'records.col.requested_time', path: 'requested_time' },
      { labelKey: 'records.col.home_visit', path: 'is_home_visit', kind: 'bool' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' }
    ]
  },
  'insurance-requests': {
    key: 'insurance-requests',
    base: '/admin/insurance-requests',
    titleKey: 'records.insurance_requests',
    recordType: 'insurance_request',
    columns: [
      { labelKey: 'records.col.applicant', path: 'name' },
      { labelKey: 'records.col.account', path: 'user.name' },
      { labelKey: 'records.col.provider', path: 'provider.name' },
      { labelKey: 'records.col.plan', path: 'plan.name' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' },
      { labelKey: 'records.col.created', path: 'created_at', kind: 'datetime' }
    ]
  },
  'insurance-limit-requests': {
    key: 'insurance-limit-requests',
    base: '/admin/insurance-limit-requests',
    titleKey: 'records.limit_requests',
    recordType: 'insurance_limit_request',
    columns: [
      { labelKey: 'records.col.requester', path: 'user.name' },
      { labelKey: 'records.col.current_limit', path: 'current_limit', kind: 'money' },
      { labelKey: 'records.col.requested_increase', path: 'requested_increase', kind: 'money' },
      { labelKey: 'records.col.approved_amount', path: 'approved_amount', kind: 'money' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' },
      { labelKey: 'records.col.created', path: 'created_at', kind: 'datetime' }
    ]
  },
  jobs: {
    key: 'jobs',
    base: '/admin/jobs',
    titleKey: 'records.jobs',
    recordType: 'job_posted',
    columns: [
      { labelKey: 'records.col.job_title', path: 'title' },
      { labelKey: 'records.col.employer', path: 'organization_name' },
      { labelKey: 'records.col.category', path: 'category.name' },
      { labelKey: 'records.col.city', path: 'city.name' },
      { labelKey: 'records.col.vacancies', path: 'vacancies' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' }
    ]
  },
  'job-applications': {
    key: 'job-applications',
    base: '/admin/job-applications',
    titleKey: 'records.job_applications',
    recordType: 'job_application',
    columns: [
      { labelKey: 'records.col.applicant', path: 'applicant.name' },
      { labelKey: 'records.col.job_title', path: 'job.title' },
      { labelKey: 'records.col.employer', path: 'job.organization_name' },
      { labelKey: 'records.col.applied_at', path: 'applied_at', kind: 'datetime' },
      { labelKey: 'records.col.status', path: 'status_label', kind: 'status' }
    ]
  }
};

/** Rows are read by path, so the index signature is what the screen relies on. */
export interface RecordRow {
  [key: string]: unknown;
  id: number;
  status?: string | null;
  status_label?: string | null;
}

export interface RecordListQuery {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  /** Set when the list is opened from one account's timeline. */
  user_id?: number;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class RecordListsService {
  private api = inject(ApiService);

  list(config: RecordListConfig, query: RecordListQuery = {}): Observable<PagedResult<RecordRow>> {
    return this.api.getPaged<RecordRow>(config.base, query);
  }
}
