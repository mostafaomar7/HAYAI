import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserListBase } from '../user-list.base';
import { PatientItem, UserResource } from '../../../../../core/services/users.service';
import { LookupItem, LookupsService } from '../../../../../core/services/lookups.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { CanManageDirective } from '../../../../../shared/directives/can-manage.directive';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

/** Where the account was created (2026-11-26): the app, or a website request. */
export type SignupSource = '' | 'app' | 'website';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, CanManageDirective, TPipe, PaginationComponent],
  templateUrl: './patients.html',
  styleUrl: './patients.css'
})
export class Patients extends UserListBase<PatientItem> {
  override resource: UserResource = 'patients';
  private lookups = inject(LookupsService);

  governorates = signal<LookupItem[]>([]);
  genders = signal<LookupItem[]>([]);
  signupSource = signal<SignupSource>('');

  constructor() {
    super();
    this.lookups.governorates().subscribe(items => this.governorates.set(items));
    this.lookups.genders().subscribe(items => this.genders.set(items));
    this.init();
  }

  protected override extraQuery(): Record<string, unknown> {
    return { signup_source: this.signupSource() || undefined };
  }

  override resetFilters() {
    this.signupSource.set('');
    super.resetFilters();
  }
}
