import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-pharmacies',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './pharmacies.html',
  styleUrl: './pharmacies.css'
})
export class Pharmacies extends UserListBase<ProviderItem> {
  override resource: UserResource = 'pharmacies';
  constructor() { super(); this.init(); }
  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
