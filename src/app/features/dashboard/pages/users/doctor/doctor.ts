import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserListBase } from '../user-list.base';
import { DoctorItem, UserResource } from '../../../../../core/services/users.service';
import { LookupItem, LookupsService } from '../../../../../core/services/lookups.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { PaginationComponent } from '../../../../../shared/ui/pagination.component/pagination.component';

@Component({
  selector: 'app-doctor',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe, PaginationComponent],
  templateUrl: './doctor.html',
  styleUrl: './doctor.css'
})
export class Doctor extends UserListBase<DoctorItem> {
  override resource: UserResource = 'doctors';
  private lookups = inject(LookupsService);

  roles = signal<LookupItem[]>([]);
  specialties = signal<LookupItem[]>([]);
  subspecialties = signal<LookupItem[]>([]);

  constructor() {
    super();
    this.lookups.doctorRoles().subscribe(items => this.roles.set(items));
    this.lookups.doctorSpecialties().subscribe(items => this.specialties.set(items));
    this.init();
  }

  /* ---- "Verified by HAYAI": the admin-set line on the doctor's card ---- */

  verifying = signal<DoctorItem | null>(null);
  vChecked = false;
  vNoteEn = '';
  vNoteAr = '';
  vSaving = signal(false);
  vError = signal<string | null>(null);

  openVerification(d: DoctorItem) {
    this.openActionMenuId = null;
    this.vChecked = !!d.credentials_verified;
    this.vNoteEn = d.credentials_verified_note_en ?? '';
    this.vNoteAr = d.credentials_verified_note_ar ?? '';
    this.vError.set(null);
    this.verifying.set(d);
  }

  closeVerification() {
    this.verifying.set(null);
  }

  /**
   * The API rejects one language on its own, so the form does too — and says
   * why here rather than letting a 422 come back as a generic failure. Both
   * blank is fine: the card falls back to a default line.
   */
  saveVerification() {
    const d = this.verifying();
    if (!d) return;
    const en = this.vNoteEn.trim();
    const ar = this.vNoteAr.trim();
    if (!!en !== !!ar) {
      this.vError.set('users.credentials.both_notes');
      return;
    }
    this.vSaving.set(true);
    this.vError.set(null);
    this.svc
      .setCredentialsVerification(d.id, {
        credentials_verified: this.vChecked,
        ...(en ? { credentials_verified_note_en: en, credentials_verified_note_ar: ar } : {})
      })
      .subscribe({
        next: () => {
          this.vSaving.set(false);
          this.closeVerification();
          this.dialog.toast('success', 'users.credentials.saved');
          this.load();
        },
        error: err => {
          this.vSaving.set(false);
          this.vError.set(err.error?.message ?? 'dialog.try_again');
        }
      });
  }

  onSpecialtyChange(value: string) {
    this.specialtyFilter.set(value);
    this.subspecialtyFilter.set('');
    if (value) {
      this.lookups.doctorSubspecialties(Number(value)).subscribe(items => this.subspecialties.set(items));
    } else {
      this.subspecialties.set([]);
    }
  }
}
