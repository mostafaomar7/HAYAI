import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Managing a pharmacy on its behalf.
 *
 * These admin routes run the pharmacy owner's own code, so the shapes are the
 * owner API's. `{id}` is the pharmacy id from `GET /admin/pharmacies`; a product
 * or branch belonging to another pharmacy answers 404 rather than leaking.
 */

export interface PharmacyProduct {
  id: number;
  name: string;
  price: number;
  original_price: number | null;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
  category: string | null;
  description: string | null;
  prescription_required: boolean;
  /** Present on the deployed API though absent from the written spec. */
  barcode?: string | null;
  strength?: string | null;
  form?: string | null;
  pack_size?: string | null;
  manufacturer?: string | null;
  expiry_date?: string | null;
  quantity?: number | null;
  /** `[]` means the product was never split by branch — available everywhere. */
  branch_stock?: { branch_id: number; in_stock: boolean; quantity?: number | null }[];
  available_branch_ids?: number[];
}

export interface PharmacyBranch {
  id: number;
  name: string;
  city_id: number | null;
  city: string | null;
  area: string | null;
  address: string | null;
  hotline: string | null;
  coordinates?: { latitude: number | null; longitude: number | null } | null;
  image_url: string | null;
}

/** What `POST /admin/pharmacies` hands back — the password is shown once. */
export interface CreatedPharmacy {
  id?: number;
  name?: string;
  login?: { email?: string; phone?: string; password?: string } | null;
  [extra: string]: unknown;
}

/** One row the importer could not take, or took with something ignored. */
export interface BulkIssue {
  row: number;
  reasons: string[];
  /** True = the row was not imported at all. */
  skipped: boolean;
}

export interface BulkPreview {
  ready: boolean;
  header_row: number;
  headers: string[];
  detected_columns: Record<string, string>;
  ignored_columns: Record<string, string>;
  unrecognized_columns: string[];
  /** Matched loosely rather than by an exact alias — worth confirming. */
  fuzzy_columns: string[];
  /** Omitted by the server when there is nothing to report. */
  missing_required?: string[];
  hints: string[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  /** Omitted by the server when every row parsed cleanly. */
  issues?: BulkIssue[];
  sample: Record<string, unknown>[];
  default_branch_id?: number | null;
  /**
   * What the import would actually do, from the server running the same
   * matching in memory. `null` while the file is not `ready`, and absent on
   * an API older than the 4 Oct release — so every reader must tolerate both.
   */
  will_create?: number | null;
  will_update?: number | null;
  will_delete?: number | null;
  /** How many products the pharmacy has today. */
  existing_products?: number | null;
}

export interface BulkResult {
  mode: string;
  created: number;
  updated: number;
  deleted: number;
  imported: number;
  skipped: number;
  switched_off?: number;
  detected_columns: Record<string, string>;
  issues: BulkIssue[];
}

export type BulkMode = 'upsert' | 'replace' | 'append';

const BASE = '/admin/pharmacies';

@Injectable({ providedIn: 'root' })
export class AdminPharmaciesService {
  private api = inject(ApiService);

  /** The account is approved at once and the password comes back once. */
  createPharmacy(body: Record<string, unknown>): Observable<CreatedPharmacy> {
    return this.api.post<CreatedPharmacy>(BASE, body);
  }

  // ------------------------------------------------------------- products

  products(
    id: number,
    query: { q?: string; category?: string; page?: number; per_page?: number } = {}
  ): Observable<PagedResult<PharmacyProduct>> {
    return this.api.getPaged<PharmacyProduct>(`${BASE}/${id}/products`, query);
  }

  createProduct(id: number, body: Record<string, unknown>): Observable<PharmacyProduct> {
    return this.api.post<PharmacyProduct>(`${BASE}/${id}/products`, body);
  }

  updateProduct(
    id: number,
    productId: number,
    body: Record<string, unknown>
  ): Observable<PharmacyProduct> {
    return this.api.patch<PharmacyProduct>(`${BASE}/${id}/products/${productId}`, body);
  }

  deleteProduct(id: number, productId: number): Observable<void> {
    return this.api.delete<void>(`${BASE}/${id}/products/${productId}`);
  }

  // ---------------------------------------------------------- bulk upload

  /**
   * Dry run: writes nothing, and reports which column it thought was which.
   * The flow is preview first, then upload, so a mis-mapped price column is
   * caught before it becomes the public price.
   */
  previewUpload(
    id: number,
    file: File,
    mode: BulkMode,
    branchId?: number | null
  ): Observable<BulkPreview> {
    // The mode has to go with the preview: the server runs the real matching
    // in memory to produce will_create / will_update / will_delete, and those
    // differ completely between upsert and replace.
    return this.api.postMultipart<BulkPreview>(
      `${BASE}/${id}/products/bulk-upload/preview`,
      this.uploadForm(file, mode, branchId)
    );
  }

  upload(
    id: number,
    file: File,
    mode: BulkMode,
    branchId?: number | null,
    columnMap?: Record<string, string>
  ): Observable<BulkResult> {
    const form = this.uploadForm(file, mode, branchId);
    if (columnMap && Object.keys(columnMap).length) {
      form.append('column_map', JSON.stringify(columnMap));
    }
    return this.api.postMultipart<BulkResult>(`${BASE}/${id}/products/bulk-upload`, form);
  }

  private uploadForm(file: File, mode?: BulkMode, branchId?: number | null): FormData {
    const form = new FormData();
    form.append('file', file);
    if (mode) form.append('mode', mode);
    if (branchId) form.append('branch_id', String(branchId));
    return form;
  }

  // ------------------------------------------------------------- branches

  /** Not paginated: the owner API returns a flat array with no `meta`. */
  branches(id: number): Observable<PharmacyBranch[]> {
    return this.api.get<PharmacyBranch[]>(`${BASE}/${id}/branches`);
  }

  createBranch(id: number, body: Record<string, unknown>): Observable<PharmacyBranch> {
    return this.api.post<PharmacyBranch>(`${BASE}/${id}/branches`, body);
  }

  updateBranch(
    id: number,
    branchId: number,
    body: Record<string, unknown>
  ): Observable<PharmacyBranch> {
    return this.api.patch<PharmacyBranch>(`${BASE}/${id}/branches/${branchId}`, body);
  }

  deleteBranch(id: number, branchId: number): Observable<void> {
    return this.api.delete<void>(`${BASE}/${id}/branches/${branchId}`);
  }
}
