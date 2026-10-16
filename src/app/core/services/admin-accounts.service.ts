import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * Admin accounts and roles — super-admin only on the API
 * (docs/backend-contract/admin-access-2026-10-16.md §5–6).
 */

export type AdminStatus = 'active' | 'blocked';

export interface AdminAccount {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  language: 'en' | 'ar' | string | null;
  status: AdminStatus | string;
  is_super_admin: boolean;
  roles: string[];
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string | null;
  /** On detail, edit and change-roles only. */
  permissions?: string[];
  website_permissions?: string[];
}

export interface AdminAccountInput {
  name: string;
  email: string;
  phone?: string | null;
  language?: 'en' | 'ar';
}

/** `sent`, or the reason the super-admin has to pass the password on. */
export type InvitationStatus = 'sent' | 'failed' | 'not_configured' | string;

export interface AdminCreated {
  admin: AdminAccount;
  /** Shown once. The API never returns it again. */
  temporary_password: string;
  invitation_sent: boolean;
  invitation_email_status: InvitationStatus;
  invitation_error: string | null;
}

export interface AdminPasswordReset {
  admin: AdminAccount;
  /** Shown once, like a new account's temporary password. */
  password: string;
  must_change_password: true;
  sessions_revoked: boolean;
}

export interface DashboardAreaDef {
  area: string;
  label: string;
  label_ar: string;
  /** `[<area>.view]` or `[<area>.view, <area>.manage]`. */
  permissions: string[];
}

export interface AccessCatalog {
  dashboard: DashboardAreaDef[];
  /** Website permission groups: `{cms: ['cms.view', …], leads: […]}`. */
  website: Record<string, string[]>;
  all: string[];
  implies?: Record<string, string>;
}

export interface AccessRole {
  id: number;
  name: string;
  is_super_admin: boolean;
  /** Preset roles. Editable; marked only. */
  is_system: boolean;
  permissions: string[];
  website_permissions: string[];
  admins_count: number;
}

export interface AdminListQuery {
  search?: string;
  status?: AdminStatus | '';
  role?: string;
  page?: number;
  per_page?: number;
}

const BASE = '/admin/access';

@Injectable({ providedIn: 'root' })
export class AdminAccountsService {
  private api = inject(ApiService);

  // ── admins ─────────────────────────────────────────────────────

  list(query: AdminListQuery = {}): Observable<PagedResult<AdminAccount>> {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(query)) if (v !== '' && v !== undefined && v !== null) params[k] = v;
    return this.api.getPaged<AdminAccount>(`${BASE}/admins`, params);
  }

  get(id: number): Observable<AdminAccount> {
    return this.api.get<AdminAccount>(`${BASE}/admins/${id}`);
  }

  create(body: AdminAccountInput & { roles: string[] }): Observable<AdminCreated> {
    return this.api.post<AdminCreated>(`${BASE}/admins`, body);
  }

  update(id: number, body: Partial<AdminAccountInput>): Observable<AdminAccount> {
    return this.api.patch<AdminAccount>(`${BASE}/admins/${id}`, body);
  }

  /** Replaces the admin's roles. */
  setRoles(id: number, roles: string[]): Observable<AdminAccount> {
    return this.api.put<AdminAccount>(`${BASE}/admins/${id}/roles`, { roles });
  }

  /** Blocks the account and signs it out of every device at once. */
  deactivate(id: number): Observable<AdminAccount> {
    return this.api.post<AdminAccount>(`${BASE}/admins/${id}/deactivate`);
  }

  reactivate(id: number): Observable<AdminAccount> {
    return this.api.post<AdminAccount>(`${BASE}/admins/${id}/reactivate`);
  }

  /** Not for a super-admin; that is done on the server only. */
  resetPassword(id: number): Observable<AdminPasswordReset> {
    return this.api.post<AdminPasswordReset>(`${BASE}/admins/${id}/reset-password`);
  }

  /** Only while `must_change_password` is true. Issues a new temporary password. */
  resendInvitation(id: number): Observable<AdminCreated> {
    return this.api.post<AdminCreated>(`${BASE}/admins/${id}/resend-invitation`);
  }

  // ── roles ──────────────────────────────────────────────────────

  catalog(): Observable<AccessCatalog> {
    return this.api.get<AccessCatalog>(`${BASE}/permissions`);
  }

  roles(): Observable<AccessRole[]> {
    return this.api.get<AccessRole[]>(`${BASE}/roles`);
  }

  role(id: number): Observable<AccessRole> {
    return this.api.get<AccessRole>(`${BASE}/roles/${id}`);
  }

  createRole(body: { name: string; permissions: string[] }): Observable<AccessRole> {
    return this.api.post<AccessRole>(`${BASE}/roles`, body);
  }

  /** `permissions` replaces the role's whole list, dashboard and website together. */
  updateRole(id: number, body: { name?: string; permissions?: string[] }): Observable<AccessRole> {
    return this.api.patch<AccessRole>(`${BASE}/roles/${id}`, body);
  }

  deleteRole(id: number): Observable<unknown> {
    return this.api.delete(`${BASE}/roles/${id}`);
  }
}
