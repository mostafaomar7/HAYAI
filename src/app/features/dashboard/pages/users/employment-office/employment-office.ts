import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-employment-office',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './employment-office.html',
  styleUrl: './employment-office.css'
})
export class EmploymentOffice extends UserListBase<ProviderItem> {
  override resource: UserResource = 'employment-offices';
  constructor() { super(); this.init(); }
}
