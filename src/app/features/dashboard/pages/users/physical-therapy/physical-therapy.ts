import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';

@Component({
  selector: 'app-physical-therapy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './physical-therapy.html',
  styleUrl: './physical-therapy.css'
})
export class PhysicalTherapy extends UserListBase<ProviderItem> {
  override resource: UserResource = 'physical-therapy';
  constructor() { super(); this.init(); }
  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
