import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';

@Component({
  selector: 'app-medical-issuance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medical-issuance.html',
  styleUrl: './medical-issuance.css'
})
export class MedicalIssuance extends UserListBase<ProviderItem> {
  override resource: UserResource = 'medical-issuance';
  constructor() { super(); this.init(); }
  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
