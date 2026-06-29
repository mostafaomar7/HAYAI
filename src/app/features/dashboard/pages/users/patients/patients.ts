import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { PatientItem, UserResource } from '../../../../../core/services/users.service';
import { LookupItem, LookupsService } from '../../../../../core/services/lookups.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './patients.html',
  styleUrl: './patients.css'
})
export class Patients extends UserListBase<PatientItem> {
  override resource: UserResource = 'patients';
  private lookups = inject(LookupsService);

  governorates = signal<LookupItem[]>([]);
  genders = signal<LookupItem[]>([]);

  constructor() {
    super();
    this.lookups.governorates().subscribe(items => this.governorates.set(items));
    this.lookups.genders().subscribe(items => this.genders.set(items));
    this.init();
  }

  blockUser(id: number) {
    this.setStatus(id, 'blocked');
  }

  unblockUser(id: number) {
    this.setStatus(id, 'active');
  }
}
