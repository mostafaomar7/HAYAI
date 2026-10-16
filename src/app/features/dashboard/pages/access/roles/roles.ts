import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AccessCatalog,
  AccessRole,
  AdminAccountsService,
  DashboardAreaDef
} from '../../../../../core/services/admin-accounts.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { permLabel, roleLabel, websiteGroupLabel } from '../access-labels';

/** Lowercase words joined by hyphens: `pharmacy-desk`. The API's rule. */
const ROLE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Roles & permissions (super-admin only).
 *
 * A role is one list of permissions covering both halves of the dashboard:
 * a View / Manage pair per dashboard area, and the website CMS permissions
 * underneath. Manage includes View — ticking it ticks View, and unticking
 * View clears Manage — because the API reads them that way and a role saved
 * as "manage without view" would mean the same thing anyway.
 *
 * `super-admin` can do everything and cannot be edited or deleted; it opens
 * read-only. A role still held by admins cannot be deleted (the API answers
 * 422), so its button is disabled with the reason.
 */
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './roles.html',
  styleUrls: ['../../website/shared/website.shared.css', '../access.css']
})
export class Roles {
  private api = inject(AdminAccountsService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);

  roles = signal<AccessRole[]>([]);
  catalog = signal<AccessCatalog | null>(null);
  loading = signal(true);
  loadError = signal<string | null>(null);

  modalOpen = signal(false);
  editing = signal<AccessRole | null>(null);
  roleName = signal('');
  picked = signal<Set<string>>(new Set());
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});

  readonly readOnly = computed(() => !!this.editing()?.is_super_admin);

  readonly websiteGroups = computed(() =>
    Object.entries(this.catalog()?.website ?? {}).map(([name, perms]) => ({ name, perms })));

  readonly websiteCount = computed(() => {
    const all = new Set(this.websiteGroups().flatMap(g => g.perms));
    return [...this.picked()].filter(p => all.has(p)).length;
  });

  constructor() {
    this.load();
    this.api.catalog().subscribe({
      next: c => this.catalog.set(c),
      error: err => this.loadError.set(errorMessage(err, 'access.roles.load_failed'))
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.roles().subscribe({
      next: r => {
        // super-admin first, then the presets, then the rest by name.
        const rank = (x: AccessRole) => (x.is_super_admin ? 0 : x.is_system ? 1 : 2);
        this.roles.set([...r].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)));
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'access.roles.load_failed'));
        this.loading.set(false);
      }
    });
  }

  // ── labels ──────────────────────────────────────────────────────

  label(name: string): string {
    return roleLabel(this.i18n, name);
  }

  areaLabel(a: DashboardAreaDef): string {
    return this.i18n.lang() === 'ar' ? (a.label_ar || a.label) : a.label;
  }

  perm(p: string): string {
    return permLabel(this.i18n, p);
  }

  group(name: string): string {
    return websiteGroupLabel(this.i18n, name);
  }

  /** The areas a role reaches, for the list: "Pharmacies (manage), Labs". */
  summary(r: AccessRole): string {
    const cat = this.catalog();
    if (!cat) return '';
    const set = new Set(r.permissions);
    return cat.dashboard
      .filter(a => set.has(`${a.area}.view`) || set.has(`${a.area}.manage`))
      .map(a => set.has(`${a.area}.manage`) ? `${this.areaLabel(a)} ✎` : this.areaLabel(a))
      .join(this.i18n.lang() === 'ar' ? '، ' : ', ');
  }

  // ── the matrix ─────────────────────────────────────────────────

  hasManage(a: DashboardAreaDef): boolean {
    return a.permissions.includes(`${a.area}.manage`);
  }

  viewOn(a: DashboardAreaDef): boolean {
    const s = this.picked();
    return s.has(`${a.area}.view`) || s.has(`${a.area}.manage`);
  }

  manageOn(a: DashboardAreaDef): boolean {
    return this.picked().has(`${a.area}.manage`);
  }

  setView(a: DashboardAreaDef, on: boolean): void {
    this.edit(s => {
      if (on) s.add(`${a.area}.view`);
      else { s.delete(`${a.area}.view`); s.delete(`${a.area}.manage`); }
    });
  }

  setManage(a: DashboardAreaDef, on: boolean): void {
    this.edit(s => {
      if (on) { s.add(`${a.area}.manage`); s.add(`${a.area}.view`); }
      else s.delete(`${a.area}.manage`);
    });
  }

  /** "View everything" / "Manage everything" / "Clear", for the dashboard half. */
  setAll(level: 'view' | 'manage' | 'none'): void {
    const areas = this.catalog()?.dashboard ?? [];
    this.edit(s => {
      for (const a of areas) {
        s.delete(`${a.area}.view`);
        s.delete(`${a.area}.manage`);
        if (level === 'none') continue;
        s.add(`${a.area}.view`);
        if (level === 'manage' && this.hasManage(a)) s.add(`${a.area}.manage`);
      }
    });
  }

  hasPerm(p: string): boolean {
    return this.picked().has(p);
  }

  togglePerm(p: string, on: boolean): void {
    this.edit(s => { if (on) s.add(p); else s.delete(p); });
  }

  private edit(fn: (s: Set<string>) => void): void {
    if (this.readOnly()) return;
    this.picked.update(prev => {
      const next = new Set(prev);
      fn(next);
      return next;
    });
  }

  // ── the editor ─────────────────────────────────────────────────

  open(role: AccessRole | null): void {
    this.editing.set(role);
    this.roleName.set(role?.name ?? '');
    this.picked.set(new Set([...(role?.permissions ?? []), ...(role?.website_permissions ?? [])]));
    this.formError.set(null);
    this.errors.set({});
    this.saving.set(false);
    this.modalOpen.set(true);
  }

  close(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.readOnly()) return;
    const name = this.roleName().trim();
    if (!ROLE_NAME.test(name)) {
      this.errors.set({ name: this.i18n.translate('access.roles.name_rule') });
      return;
    }
    // Only names the API knows go out. A permission that left the catalog
    // since the role was saved would fail the whole request.
    const known = new Set(this.catalog()?.all ?? []);
    const permissions = [...this.picked()].filter(p => !known.size || known.has(p));

    const role = this.editing();
    const body = role
      ? { ...(role.name !== name ? { name } : {}), permissions }
      : { name, permissions };
    const call = role ? this.api.updateRole(role.id, body) : this.api.createRole(body as { name: string; permissions: string[] });

    this.saving.set(true);
    this.formError.set(null);
    this.errors.set({});
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.dialog.toast('success', role ? 'access.roles.updated' : 'access.roles.created');
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.errors.set(fieldErrors(err));
        this.formError.set(errorMessage(err, 'access.roles.save_failed'));
      }
    });
  }

  async remove(role: AccessRole): Promise<void> {
    if (role.is_super_admin || role.admins_count > 0) return;
    const ok = await this.dialog.confirm({
      title: 'access.roles.delete_title',
      text: 'access.roles.delete_text',
      params: { name: this.label(role.name) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'access.roles.deleted');
        this.load();
      },
      error: err => this.dialog.error('common.error', errorMessage(err, 'access.roles.delete_failed'))
    });
  }
}
