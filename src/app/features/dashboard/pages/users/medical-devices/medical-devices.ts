import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-medical-devices',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './medical-devices.html',
  styleUrl: './medical-devices.css'
})
export class MedicalDevices extends UserListBase<ProviderItem> {
  override resource: UserResource = 'medical-devices';
  constructor() { super(); this.init(); }
}
