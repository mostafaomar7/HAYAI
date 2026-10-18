import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/**
 * Senior care homes.
 *
 * A hospital profile tagged `facility_type: "senior_care"` on the backend, with
 * the hospital feature set and its own plans. It is a section of its own rather
 * than a filter on the hospitals list, because an admin looking at hospitals is
 * not looking at these: the two are sold separately and approved separately.
 *
 * Everything else comes from `UserListBase` — the resource is the path segment
 * the API serves, so the list, the detail, the status change, the plan change
 * and the delete all follow from this one line.
 */
@Component({
  selector: 'app-senior-care',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './senior-care.html',
  styleUrl: './senior-care.css'
})
export class SeniorCare extends UserListBase<ProviderItem> {
  override resource: UserResource = 'senior-care';
  constructor() { super(); this.init(); }
}
