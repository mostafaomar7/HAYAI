import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebsiteApiService, errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { WebsiteContextService } from '../../../../../core/services/website/website-context.service';
import { PermissionCatalog, WebsiteAdmin, WebsiteRole } from '../../../../../core/services/website/website.models';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

type RolesTab = 'roles' | 'admins';

/** Holds every permission and cannot be edited; the backend refuses, so the UI shows it read-only. */
const SUPER_ADMIN = 'super-admin';

/**
 * Website roles & admin access (§16, roles.manage).
 *
 * Roles bundle the granular website permissions; admins get roles. New
 * admins have no website access until given one, and the backend keeps at
 * least one super-admin (its refusal message is shown as-is). When an admin
 * edits their own roles the cached `/me` is dropped and re-read so the
 * sidebar and every permission check follow immediately.
 */
@Component({
  selector: 'app-website-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './website-roles.html',
  styleUrls: ['../shared/website.shared.css', './website-roles.css']
})
export class WebsiteRoles {
  private api = inject(WebsiteApiService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private ctx = inject(WebsiteContextService);

  readonly superAdmin = SUPER_ADMIN;
  tab = signal<RolesTab>('roles');

  roles = signal<WebsiteRole[]>([]);
  rolesLoading = signal(true);
  rolesError = signal<string | null>(null);
  catalog = signal<PermissionCatalog | null>(null);

  admins = signal<WebsiteAdmin[]>([]);
  adminsLoading = signal(false);
  adminsError = signal<string | null>(null);
  adminSearch = signal('');
  private adminsLoaded = false;

  // role editor
  roleModal = signal(false);
  editingRole = signal<WebsiteRole | null>(null);
  roleName = signal('');
  rolePerms = signal<Set<string>>(new Set());

  // admin roles editor
  adminModal = signal(false);
  editingAdmin = signal<WebsiteAdmin | null>(null);
  adminRoles = signal<Set<string>>(new Set());

  saving = signal(false);
  errors = signal<Record<string, string>>({});
  formError = signal<string | null>(null);

  /** Permission groups in catalog order; falls back to splitting `all` on the dot. */
  readonly groups = computed(() => {
    const c = this.catalog();
    if (!c) return [];
    if (c.grouped && Object.keys(c.grouped).length) {
      return Object.entries(c.grouped).map(([name, perms]) => ({ name, perms }));
    }
    const map = new Map<string, string[]>();
    for (const p of c.all ?? []) {
      const g = p.split('.')[0];
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return [...map.entries()].map(([name, perms]) => ({ name, perms }));
  });

  readonly totalPerms = computed(() => this.catalog()?.all?.length ?? 0);

  readonly roleReadOnly = computed(() => this.editingRole()?.name === SUPER_ADMIN);

  readonly filteredAdmins = computed(() => {
    const q = this.adminSearch().trim().toLowerCase();
    if (!q) return this.admins();
    return this.admins().filter(a =>
      (a.name ?? '').toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q) ||
      a.roles.some(r => r.toLowerCase().includes(q))
    );
  });

  readonly myId = computed(() => this.ctx.me()?.id ?? null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const t = q.get('tab') === 'admins' ? 'admins' : 'roles';
      this.tab.set(t);
      if (t === 'admins' && !this.adminsLoaded) this.loadAdmins();
    });
    this.loadRoles();
    this.api.permissions().pipe(takeUntilDestroyed()).subscribe({
      next: c => this.catalog.set(c),
      error: () => this.catalog.set(null)
    });
  }

  selectTab(tab: RolesTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'roles' ? null : tab }, replaceUrl: true });
  }

  loadRoles(): void {
    this.rolesLoading.set(true);
    this.rolesError.set(null);
    this.api.roles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.roles.set(rows ?? []);
        this.rolesLoading.set(false);
      },
      error: err => {
        this.rolesError.set(errorMessage(err, 'web.roles.load_failed'));
        this.rolesLoading.set(false);
      }
    });
  }

  loadAdmins(): void {
    this.adminsLoaded = true;
    this.adminsLoading.set(true);
    this.adminsError.set(null);
    this.api.admins().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.admins.set(rows ?? []);
        this.adminsLoading.set(false);
      },
      error: err => {
        this.adminsLoaded = false;
        this.adminsError.set(errorMessage(err, 'web.roles.load_failed'));
        this.adminsLoading.set(false);
      }
    });
  }

  // ── labels ──────────────────────────────────────────────────────

  roleLabel(name: string): string {
    const k = `web.role.${name}`;
    const t = this.i18n.translate(k);
    return t === k ? name : t;
  }

  permLabel(perm: string): string {
    const k = `web.perm.${perm}`;
    const t = this.i18n.translate(k);
    return t === k ? perm : t;
  }

  groupLabel(group: string): string {
    const k = `web.roles.group.${group}`;
    const t = this.i18n.translate(k);
    return t === k ? group : t;
  }

  // ── role editor ─────────────────────────────────────────────────

  openRole(role: WebsiteRole | null): void {
    this.editingRole.set(role);
    this.roleName.set(role?.name ?? '');
    // super-admin is "everything" whatever its stored list says.
    const perms = role?.name === SUPER_ADMIN ? this.catalog()?.all ?? role.permissions : role?.permissions ?? [];
    this.rolePerms.set(new Set(perms));
    this.resetErrors();
    this.roleModal.set(true);
  }

  hasPerm(p: string): boolean {
    return this.rolePerms().has(p);
  }

  togglePerm(p: string, on: boolean): void {
    this.rolePerms.update(s => {
      const next = new Set(s);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  groupState(perms: string[]): 'all' | 'some' | 'none' {
    const n = perms.filter(p => this.rolePerms().has(p)).length;
    return n === 0 ? 'none' : n === perms.length ? 'all' : 'some';
  }

  toggleGroup(perms: string[], on: boolean): void {
    this.rolePerms.update(s => {
      const next = new Set(s);
      for (const p of perms) {
        if (on) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }

  saveRole(): void {
    if (this.roleReadOnly()) return;
    const editing = this.editingRole();
    const permissions = [...this.rolePerms()];
    const name = this.roleName().trim();
    // System roles keep their name (the backend relies on it); only the permissions change.
    const body = editing?.is_system ? { permissions } : { name, permissions };
    this.saving.set(true);
    this.resetErrors();
    const req = editing ? this.api.updateRole(editing.id, body) : this.api.createRole({ name, permissions });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.roleModal.set(false);
        this.dialog.toast('success', editing ? 'web.roles.role_updated' : 'web.roles.role_created');
        this.loadRoles();
        // If the edited role is one of mine, my effective permissions just changed.
        if (editing && this.ctx.me()?.roles.includes(editing.name)) this.refreshMe();
      },
      error: err => this.onSaveError(err)
    });
  }

  async deleteRole(role: WebsiteRole): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'web.roles.delete_title',
      text: 'web.roles.delete_text',
      params: { name: this.roleLabel(role.name) },
      confirmText: 'common.delete',
      danger: true
    });
    if (!ok) return;
    this.api.deleteRole(role.id).subscribe({
      next: () => {
        this.dialog.toast('success', 'web.roles.role_deleted');
        this.loadRoles();
      },
      // Refused while any admin holds the role — the backend says so.
      error: err => this.dialog.error('common.error', errorMessage(err, 'web.roles.delete_failed'))
    });
  }

  // ── admin roles editor ──────────────────────────────────────────

  openAdmin(admin: WebsiteAdmin): void {
    this.editingAdmin.set(admin);
    this.adminRoles.set(new Set(admin.roles));
    this.resetErrors();
    this.adminModal.set(true);
    // The modal lists role names, so make sure the roles list is there.
    if (!this.roles().length && !this.rolesLoading()) this.loadRoles();
  }

  hasAdminRole(name: string): boolean {
    return this.adminRoles().has(name);
  }

  toggleAdminRole(name: string, on: boolean): void {
    this.adminRoles.update(s => {
      const next = new Set(s);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  async saveAdmin(): Promise<void> {
    const admin = this.editingAdmin();
    if (!admin) return;
    const roles = [...this.adminRoles()];
    const isMe = admin.id === this.myId();

    // Removing your own roles can lock you out of this very screen.
    if (isMe && admin.roles.includes(SUPER_ADMIN) && !roles.includes(SUPER_ADMIN)) {
      const ok = await this.dialog.confirm({
        title: 'web.roles.self_demote_title',
        text: 'web.roles.self_demote_text',
        confirmText: 'common.continue',
        danger: true
      });
      if (!ok) return;
    }

    this.saving.set(true);
    this.resetErrors();
    this.api.setAdminRoles(admin.id, roles).subscribe({
      next: updated => {
        this.saving.set(false);
        this.adminModal.set(false);
        this.admins.update(list => list.map(a => (a.id === admin.id ? { ...a, ...(updated ?? {}), roles: updated?.roles ?? roles } : a)));
        this.dialog.toast('success', 'web.roles.admin_updated');
        // admins_count per role changed too.
        this.loadRoles();
        if (isMe) this.refreshMe();
      },
      error: err => this.onSaveError(err)
    });
  }

  /** Drops the cached `/me` and re-reads it so the sidebar and guards see the new permissions. */
  private refreshMe(): void {
    this.ctx.reset();
    this.ctx.load().subscribe(me => {
      if (!me || !me.permissions.includes('roles.manage')) {
        // No longer allowed here — leave before every call starts failing.
        this.router.navigate(['/dashboard/website']);
      }
    });
  }

  // ── shared ──────────────────────────────────────────────────────

  closeModals(): void {
    if (this.saving()) return;
    this.roleModal.set(false);
    this.adminModal.set(false);
  }

  private resetErrors(): void {
    this.errors.set({});
    this.formError.set(null);
  }

  private onSaveError(err: any): void {
    this.saving.set(false);
    if (err?.status === 422) {
      this.errors.set(fieldErrors(err));
      this.formError.set(errorMessage(err, 'web.roles.save_failed'));
    } else {
      // 403/409-style refusals (last super-admin, editing super-admin) carry a readable message.
      this.formError.set(errorMessage(err, 'web.roles.save_failed'));
    }
  }

  statusClass(status: string | null | undefined): string {
    return status === 'active' ? 'pill-active' : status ? 'pill-inactive' : 'pill-draft';
  }
}
