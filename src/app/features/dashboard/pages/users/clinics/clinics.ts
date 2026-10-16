import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-clinics',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe, PaginationComponent],
  templateUrl: './clinics.html',
  styleUrl: './clinics.css'
})
export class Clinics extends UserListBase<ProviderItem> {
  override resource: UserResource = 'clinics';
  constructor() { super(); this.init(); }
}
