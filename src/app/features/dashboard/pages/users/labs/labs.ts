import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-labs',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe, PaginationComponent],
  templateUrl: './labs.html',
  styleUrl: './labs.css'
})
export class Labs extends UserListBase<ProviderItem> {
  override resource: UserResource = 'labs';
  constructor() { super(); this.init(); }
}
