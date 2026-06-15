import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { DoctorItem, UserResource } from '../../../../../core/services/users.service';
import { LookupItem, LookupsService } from '../../../../../core/services/lookups.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-doctor',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css'
})
export class Doctor extends UserListBase<DoctorItem> {
  override resource: UserResource = 'doctors';
  private lookups = inject(LookupsService);

  roles = signal<LookupItem[]>([]);
  specialties = signal<LookupItem[]>([]);
  subspecialties = signal<LookupItem[]>([]);

  constructor() {
    super();
    this.lookups.doctorRoles().subscribe(items => this.roles.set(items));
    this.lookups.doctorSpecialties().subscribe(items => this.specialties.set(items));
    this.init();
  }

  onSpecialtyChange(value: string) {
    this.specialtyFilter.set(value);
    this.subspecialtyFilter.set('');
    if (value) {
      this.lookups.doctorSubspecialties(Number(value)).subscribe(items => this.subspecialties.set(items));
    } else {
      this.subspecialties.set([]);
    }
  }

  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
