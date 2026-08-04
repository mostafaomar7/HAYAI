import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { TouristItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-tourists',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './tourists.html',
  styleUrl: './tourists.css'
})
export class Tourists extends UserListBase<TouristItem> {
  override resource: UserResource = 'tourists';
  constructor() { super(); this.init(); }
}
