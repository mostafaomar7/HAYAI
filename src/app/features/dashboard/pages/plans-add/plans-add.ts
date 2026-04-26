import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-plans-add',
  standalone: true,
  imports: [CommonModule , FormsModule],
  templateUrl: './plans-add.html',
  styleUrl: './plans-add.css',
})
export class PlansAdd {
  private location = inject(Location);

  // مصفوفة الـ Modules، بنتحكم في الـ checked بتاعها من الـ HTML
  modules = [
    { id: 'patient', name: 'Patient Management', checked: true },
    { id: 'appointments', name: 'Appointments', checked: false },
    { id: 'analytics', name: 'Analytics', checked: true },
    { id: 'billing', name: 'Billing', checked: false },
    { id: 'inventory', name: 'Inventory', checked: true },
  ];

  goBack() {
    this.location.back();
  }

  // دالة عشان ترجعلنا بس الـ Modules اللي معمولها Check
  get checkedModules() {
    return this.modules.filter(m => m.checked);
  }
}