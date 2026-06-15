import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';

@Component({
  selector: 'app-home-care',
  standalone: true,
  imports: [CommonModule, TPipe],
  templateUrl: './home-care.html',
  styleUrl: './home-care.css'
})
export class HomeCare extends UserListBase<ProviderItem> {
  override resource: UserResource = 'home-care';
  constructor() { super(); this.init(); }
  deactivate(id: number) { this.setStatus(id, 'inactive'); }
}
