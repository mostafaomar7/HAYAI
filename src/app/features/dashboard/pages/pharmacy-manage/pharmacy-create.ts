import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminPharmaciesService } from '../../../../core/services/admin-pharmacies.service';
import { PlansService, Plan } from '../../../../core/services/plans.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface Draft {
  name: string;
  email: string;
  phone: string;
  country_code: string;
  password: string;
  plan_id: string;
  address: string;
  location: string;
}

/**
 * Opens a pharmacy account on the team's behalf. The account is approved at
 * once and the password comes back exactly once, so it is shown in a dialog
 * that has to be dismissed rather than a toast.
 */
@Component({
  selector: 'app-pharmacy-create',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './pharmacy-create.html',
  styleUrl: './pharmacy-create.css'
})
export class PharmacyCreate {
  private svc = inject(AdminPharmaciesService);
  private plansSvc = inject(PlansService);
  private dialog = inject(DialogService);
  private router = inject(Router);

  saving = signal(false);
  formError = signal<string | null>(null);
  errors = signal<Record<string, string>>({});
  plans = signal<Plan[]>([]);

  draft = signal<Draft>({
    name: '', email: '', phone: '', country_code: '+20',
    password: '', plan_id: '', address: '', location: ''
  });

  constructor() {
    this.plansSvc.list({ per_page: 200, plan_type: 'pharmacies' }).subscribe({
      next: r => this.plans.set(r.items),
      // The plan is optional; without the list the field is simply left out.
      error: () => this.plans.set([])
    });
  }

  set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update(d => ({ ...d, [key]: value }));
    this.errors.update(e => { const n = { ...e }; delete n[key]; return n; });
  }

  save(): void {
    const d = this.draft();
    const errors: Record<string, string> = {};
    if (!d.name.trim()) errors['name'] = 'pharm.required';
    if (!d.email.trim()) errors['email'] = 'pharm.required';
    else if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) errors['email'] = 'pharm.email_invalid';
    if (!d.phone.trim()) errors['phone'] = 'pharm.required';
    if (d.password.trim() && d.password.trim().length < 8) errors['password'] = 'pharm.password_short';
    this.errors.set(errors);
    if (Object.keys(errors).length) return;

    const body: Record<string, unknown> = {
      name: d.name.trim(),
      email: d.email.trim(),
      phone: d.phone.trim()
    };
    if (d.country_code.trim()) body['country_code'] = d.country_code.trim();
    // Left empty, the server generates one — which is the normal case.
    if (d.password.trim()) body['password'] = d.password.trim();
    if (d.plan_id) body['plan_id'] = Number(d.plan_id);
    if (d.address.trim()) body['address'] = d.address.trim();
    if (d.location.trim()) body['location'] = d.location.trim();

    this.saving.set(true);
    this.formError.set(null);
    this.svc.createPharmacy(body).subscribe({
      next: async res => {
        this.saving.set(false);
        const password = res.login?.password;
        if (password) {
          // Shown once and stored nowhere; a second call issues a different one.
          await this.dialog.revealSecret({
            title: 'pharm.created_title',
            text: 'pharm.created_text',
            secret: password
          });
        } else {
          this.dialog.toast('success', 'pharm.created_title');
        }
        const id = Number(res.id);
        this.router.navigate(
          Number.isFinite(id) && id > 0
            ? ['/dashboard/pharmacies', id, 'manage']
            : ['/dashboard/pharmacies']
        );
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const bag = err.error?.errors as Record<string, string[] | string> | undefined;
        if (err.status === 422 && bag) {
          this.errors.set(Object.fromEntries(
            Object.entries(bag).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
          this.formError.set('pharm.fix_errors');
        } else {
          this.formError.set(err.error?.message ?? 'pharm.create_failed');
        }
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/pharmacies']);
  }
}
