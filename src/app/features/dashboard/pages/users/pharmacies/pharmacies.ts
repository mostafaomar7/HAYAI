import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { ProviderItem, UserResource } from '../../../../../core/services/users.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-pharmacies',
  standalone: true,
  imports: [CommonModule, TPipe, PaginationComponent],
  templateUrl: './pharmacies.html',
  styleUrl: './pharmacies.css'
})
export class Pharmacies extends UserListBase<ProviderItem> {
  override resource: UserResource = 'pharmacies';
  constructor() { super(); this.init(); }

  /**
   * Runs this pharmacy's catalogue on its behalf. Provider rows are keyed by
   * organization id, which is what the admin pharmacy routes expect.
   */
  /** Opens an account on the pharmacy's behalf; the password is shown once. */
  createPharmacy(): void {
    this.router.navigate(['/dashboard/pharmacies/new']);
  }

  managePharmacy(row: { id: number }): void {
    this.openActionMenuId = null;
    this.router.navigate(['/dashboard/pharmacies', row.id, 'manage']);
  }
}
