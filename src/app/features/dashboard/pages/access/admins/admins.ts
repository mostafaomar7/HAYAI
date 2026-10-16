import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AccessRole,
  AdminAccount,
  AdminAccountsService,
  InvitationStatus
} from '../../../../../core/services/admin-accounts.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';
import { errorMessage, fieldErrors } from '../../../../../core/services/website/website-api.service';
import { roleLabel } from '../access-labels';

type Modal = 'create' | 'edit' | 'roles' | 'password' | null;

/** What the one-time password modal shows. */
interface PasswordShown {
  name: string;
  email: string;
  password: string;
  /** Absent after a reset, which sends no email. */
  emailStatus?: InvitationStatus;
  kind: 'created' | 'invitation' | 'reset';
}

/**
 * Admin accounts (super-admin only).
 *
 * Each person who uses the dashboard gets their own account and one or more
 * roles. A new account's temporary password is shown once, here, and never
 * again; the invitation email carries the same one. There is no delete:
 * deactivating keeps the person's audit trail and signs them out at once.
 *
 * The server refuses — 422 with the reason, shown as is — changing your own
 * roles, deactivating yourself, demoting or deactivating the last active
 * super-admin, and resetting a super-admin's password. The buttons for those
 * are hidden so the refusals are rare, not designed around.
 */
@Component({
  selector: 'app-admins',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, PaginationComponent],
  templateUrl: './admins.html',
  styleUrls: ['../../website/shared/website.shared.css', '../access.css']
})
export class Admins {
  private api = inject(AdminAccountsService);
  private auth = inject(AuthService);
  private dialog = inject(DialogService);
  private i18n = inject(I18nService);

  readonly myId = computed(() => this.auth.currentUser()?.id ?? null);

  rows = signal<AdminAccount[]>([]);
  total = signal(0);
  page = signal(1);
  readonly perPage = 15;
  loading = signal(true);
  loadError = signal<string | null>(null);

  search = signal('');
  status = signal<'' | 'active' | 'blocked'>('');
  roleFilter = signal('');

  roles = signal<AccessRole[]>([]);

  modal = signal<Modal>(null);
  editing = signal<AdminAccount | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});
  /** Row id with an action in flight, so its buttons can't be pressed twice. */
  busyId = signal<number | null>(null);

  // create / edit form
  name = '';
  email = '';
  phone = '';
  language: 'en' | 'ar' = 'ar';
  pickedRoles = signal<Set<string>>(new Set());

  shown = signal<PasswordShown | null>(null);
  copied = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    this.api.roles().subscribe({ next: r => this.roles.set(r), error: () => {} });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list({
      search: this.search().trim() || undefined,
      status: this.status(),
      role: this.roleFilter() || undefined,
      page: this.page(),
      per_page: this.perPage
    }).subscribe({
      next: r => {
        this.rows.set(r.items);
        this.total.set(r.pagination.total);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(errorMessage(err, 'access.admins.load_failed'));
        this.loading.set(false);
      }
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setStatus(value: string): void {
    this.status.set(value as '' | 'active' | 'blocked');
    this.page.set(1);
    this.load();
  }

  setRoleFilter(value: string): void {
    this.roleFilter.set(value);
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  roleName(name: string): string {
    return roleLabel(this.i18n, name);
  }

  isSelf(a: AdminAccount): boolean {
    return a.id === this.myId();
  }

  // ── modals ──────────────────────────────────────────────────────

  private resetForm(): void {
    this.formError.set(null);
    this.errors.set({});
    this.saving.set(false);
  }

  openCreate(): void {
    this.resetForm();
    this.editing.set(null);
    this.name = '';
    this.email = '';
    this.phone = '';
    this.language = this.i18n.lang() === 'en' ? 'en' : 'ar';
    this.pickedRoles.set(new Set());
    this.modal.set('create');
  }

  openEdit(a: AdminAccount): void {
    this.resetForm();
    this.editing.set(a);
    this.name = a.name;
    this.email = a.email;
    this.phone = a.phone ?? '';
    this.language = a.language === 'en' ? 'en' : 'ar';
    this.modal.set('edit');
  }

  openRoles(a: AdminAccount): void {
    this.resetForm();
    this.editing.set(a);
    this.pickedRoles.set(new Set(a.roles));
    this.modal.set('roles');
  }

  close(): void {
    this.modal.set(null);
    this.editing.set(null);
    this.shown.set(null);
    this.copied.set(false);
  }

  /**
   * The password is shown once. Closing its modal is the last chance to copy
   * it, so the close is confirmed when it was never copied.
   */
  async closePassword(): Promise<void> {
    if (!this.copied()) {
      const ok = await this.dialog.confirm({
        title: 'access.admins.password_close_title',
        text: 'access.admins.password_close_text',
        confirmText: 'common.close',
        icon: 'warning'
      });
      if (!ok) return;
    }
    this.close();
  }

  hasRole(name: string): boolean {
    return this.pickedRoles().has(name);
  }

  toggleRole(name: string, on: boolean): void {
    this.pickedRoles.update(s => {
      const next = new Set(s);
      if (on) next.add(name); else next.delete(name);
      return next;
    });
  }

  // ── saving ──────────────────────────────────────────────────────

  private failed(err: any, fallback: string): void {
    this.saving.set(false);
    this.errors.set(fieldErrors(err));
    this.formError.set(errorMessage(err, fallback));
  }

  create(): void {
    if (!this.name.trim() || !this.email.trim()) {
      this.formError.set('access.admins.required');
      return;
    }
    if (!this.pickedRoles().size) {
      // The API needs at least one; an admin with no role is refused
      // everywhere, which is never what creating one means.
      this.formError.set('access.admins.role_required');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.errors.set({});
    this.api.create({
      name: this.name.trim(),
      email: this.email.trim(),
      phone: this.phone.trim() || null,
      language: this.language,
      roles: [...this.pickedRoles()]
    }).subscribe({
      next: res => {
        this.saving.set(false);
        this.load();
        this.showPassword({
          name: res.admin.name,
          email: res.admin.email,
          password: res.temporary_password,
          emailStatus: res.invitation_email_status,
          kind: 'created'
        });
      },
      error: err => this.failed(err, 'access.admins.create_failed')
    });
  }

  saveEdit(): void {
    const a = this.editing();
    if (!a) return;
    if (!this.name.trim() || !this.email.trim()) {
      this.formError.set('access.admins.required');
      return;
    }
    this.saving.set(true);
    this.api.update(a.id, {
      name: this.name.trim(),
      email: this.email.trim(),
      phone: this.phone.trim() || null,
      language: this.language
    }).subscribe({
      next: () => {
        this.close();
        this.dialog.toast('success', 'access.admins.saved');
        this.load();
      },
      error: err => this.failed(err, 'access.admins.save_failed')
    });
  }

  saveRoles(): void {
    const a = this.editing();
    if (!a) return;
    if (!this.pickedRoles().size) {
      this.formError.set('access.admins.role_required');
      return;
    }
    this.saving.set(true);
    this.api.setRoles(a.id, [...this.pickedRoles()]).subscribe({
      next: () => {
        this.close();
        this.dialog.toast('success', 'access.admins.roles_saved');
        this.load();
      },
      error: err => this.failed(err, 'access.admins.save_failed')
    });
  }

  // ── row actions ─────────────────────────────────────────────────

  async deactivate(a: AdminAccount): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'access.admins.deactivate_title',
      text: 'access.admins.deactivate_text',
      params: { name: a.name },
      confirmText: 'access.admins.deactivate',
      danger: true
    });
    if (!ok) return;
    this.rowAction(a, this.api.deactivate(a.id), 'access.admins.deactivated');
  }

  reactivate(a: AdminAccount): void {
    this.rowAction(a, this.api.reactivate(a.id), 'access.admins.reactivated');
  }

  private rowAction(a: AdminAccount, call: ReturnType<AdminAccountsService['reactivate']>, done: string): void {
    this.busyId.set(a.id);
    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.dialog.toast('success', done);
        this.load();
      },
      error: err => {
        this.busyId.set(null);
        this.dialog.error('common.error', errorMessage(err, 'access.admins.save_failed'));
      }
    });
  }

  async resetPassword(a: AdminAccount): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'access.admins.reset_title',
      text: 'access.admins.reset_text',
      params: { name: a.name },
      confirmText: 'access.admins.reset',
      danger: true
    });
    if (!ok) return;
    this.busyId.set(a.id);
    this.api.resetPassword(a.id).subscribe({
      next: res => {
        this.busyId.set(null);
        this.load();
        this.showPassword({ name: a.name, email: a.email, password: res.password, kind: 'reset' });
      },
      error: err => {
        this.busyId.set(null);
        this.dialog.error('common.error', errorMessage(err, 'access.admins.save_failed'));
      }
    });
  }

  async resendInvitation(a: AdminAccount): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'access.admins.resend_title',
      text: 'access.admins.resend_text',
      params: { name: a.name },
      confirmText: 'access.admins.resend',
      icon: 'question'
    });
    if (!ok) return;
    this.busyId.set(a.id);
    this.api.resendInvitation(a.id).subscribe({
      next: res => {
        this.busyId.set(null);
        this.showPassword({
          name: a.name,
          email: a.email,
          password: res.temporary_password,
          emailStatus: res.invitation_email_status,
          kind: 'invitation'
        });
      },
      error: err => {
        this.busyId.set(null);
        this.dialog.error('common.error', errorMessage(err, 'access.admins.save_failed'));
      }
    });
  }

  // ── the one-time password ───────────────────────────────────────

  private showPassword(p: PasswordShown): void {
    this.editing.set(null);
    this.copied.set(false);
    this.shown.set(p);
    this.modal.set('password');
  }

  async copyPassword(): Promise<void> {
    const p = this.shown();
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p.password);
      this.copied.set(true);
      this.dialog.toast('success', 'access.admins.copied');
    } catch {
      // No clipboard (an insecure context, or permission refused): the
      // password is on screen and selectable, which is the fallback.
      this.dialog.toast('warning', 'access.admins.copy_failed');
    }
  }

  emailNotSent(p: PasswordShown): boolean {
    return p.emailStatus !== undefined && p.emailStatus !== 'sent';
  }
}
