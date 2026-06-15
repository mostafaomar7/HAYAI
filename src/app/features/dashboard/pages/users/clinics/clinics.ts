import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-clinics',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './clinics.html',
  styleUrl: './clinics.css'
})
export class Clinics extends UserListBase<ProviderItem> {
  override resource: UserResource = 'clinics';
  constructor() { super(); this.init(); }
  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
