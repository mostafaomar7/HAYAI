import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Plan, PlanModule, PlanModuleCatalog, PlansService, PlanType } from '../../../../core/services/plans.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

interface ModuleRow {
  module_key: string;
  module_name: string;
  checked: boolean;
  description: string;
}

@Component({
  selector: 'app-plans-add',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './plans-add.html',
  styleUrl: './plans-add.css'
})
export class PlansAdd {
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(PlansService);

  id = signal<number | null>(null);
  isEdit = computed(() => this.id() !== null);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  name = '';
  planType: PlanType | '' = '';
  status: 'active' | 'inactive' = 'active';
  price: number | null = null;
  months: number | null = null;
  discount = 0;
  description = '';

  modules = signal<ModuleRow[]>([]);

  planTypes: { value: PlanType; label: string }[] = [
    { value: 'hospital', label: 'Hospital' },
    { value: 'clinic', label: 'Clinic' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'general_practitioner', label: 'General Practitioner' },
    { value: 'specialist', label: 'Specialist' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'pharmacies', label: 'Pharmacies' },
    { value: 'labs_radiology', label: 'Labs & Radiology' },
    { value: 'medical_insurance', label: 'Medical Insurance' },
    { value: 'home_care', label: 'Home Care' },
    { value: 'physical_therapy', label: 'Physical Therapy' },
    { value: 'employment_office', label: 'Employment Office' },
    { value: 'medical_devices', label: 'Medical Devices' }
  ];

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.load(id);
    }
  }

  /** Called from the template whenever the Plan Type dropdown changes. */
  onPlanTypeChange(next: PlanType | '') {
    this.planType = next;
    if (!next) {
      this.modules.set([]);
      return;
    }
    // Preserve user's previous selections for module keys that still exist
    // in the new catalog; drop the rest (the backend would reject unknown keys).
    const prevByKey = new Map(this.modules().map(m => [m.module_key, m]));
    this.svc.modules(next).subscribe({
      next: catalog => {
        this.modules.set(catalog.map(c => {
          const prev = prevByKey.get(c.key);
          return {
            module_key: c.key,
            module_name: c.name,
            checked: prev?.checked ?? false,
            description: prev?.description ?? ''
          };
        }));
      },
      error: () => this.modules.set([])
    });
  }

  private seedModules(catalog: PlanModuleCatalog[], existing?: PlanModule[]) {
    this.modules.set(
      catalog.map(c => {
        const found = existing?.find(e => e.module_key === c.key);
        return {
          module_key: c.key,
          module_name: c.name,
          checked: found ? found.included : false,
          description: found?.description ?? ''
        };
      })
    );
  }

  private load(id: number) {
    this.loading.set(true);
    this.svc.get(id).subscribe({
      next: p => {
        this.name = p.name;
        this.planType = p.plan_type;
        this.status = p.status;
        this.price = Number(p.price);
        this.months = p.months;
        this.discount = p.discount;
        this.description = p.description ?? '';
        this.svc.modules(p.plan_type).subscribe(catalog => this.seedModules(catalog, p.modules));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleModule(index: number) {
    const arr = [...this.modules()];
    arr[index] = { ...arr[index], checked: !arr[index].checked };
    this.modules.set(arr);
  }

  updateModuleDescription(index: number, value: string) {
    const arr = [...this.modules()];
    arr[index] = { ...arr[index], description: value };
    this.modules.set(arr);
  }

  get checkedModules() {
    return this.modules().filter(m => m.checked);
  }

  goBack() { this.location.back(); }

  save() {
    if (!this.name || !this.planType || this.price === null || this.months === null) {
      this.errorMessage.set('Please fill in name, plan type, price and number of months.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

    const body: Partial<Plan> = {
      name: this.name,
      plan_type: this.planType as PlanType,
      status: this.status,
      price: this.price ?? 0,
      months: this.months ?? 1,
      discount: this.discount,
      description: this.description,
      modules: this.modules().map(m => ({
        module_key: m.module_key,
        module_name: m.module_name,
        included: m.checked,
        description: m.checked ? m.description : null
      }))
    };

    const id = this.id();
    const req$ = id ? this.svc.update(id, body) : this.svc.create(body);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/dashboard/plans']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(err.error?.message ?? 'Save failed');
      }
    });
  }
}
