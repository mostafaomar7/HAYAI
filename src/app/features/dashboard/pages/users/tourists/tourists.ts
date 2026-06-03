import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { TouristItem, UserResource } from '../../../../../core/services/users.service';

@Component({
  selector: 'app-tourists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tourists.html',
  styleUrl: './tourists.css'
})
export class Tourists extends UserListBase<TouristItem> {
  override resource: UserResource = 'tourists';
  constructor() { super(); this.init(); }

  blockUser(id: number) { this.setStatus(id, 'blocked'); }
}
