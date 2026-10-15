import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BroadcastGender,
  BroadcastTarget,
  DoctorSpecialty,
  NotificationsService
} from '../../../../core/services/notifications.service';
import { LookupItem, LookupsService } from '../../../../core/services/lookups.service';
import { apiErrorText } from '../../../../shared/utils/api-error.util';
import { debounce } from '../../../../shared/utils/debounce.util';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TPipe } from '../../../../core/i18n/t.pipe';

/** The API's own limits. Enforced here so a long title is caught before send. */
const TITLE_MAX = 200;
const BODY_MAX = 5000;

/** Only these two take a gender; the rest are organisations. */
const GENDERED = new Set(['patient', 'tourist']);
const DOCTOR = 'doctor';

/**
 * Fallback for an unreachable `/lookups/user-types`.
 *
 * These are the API's spellings, which are not the ones the rest of this
 * dashboard uses: `pharmacies` not `pharmacy`, `labs_radiology` not `lab`,
 * `medical_insurance` not `medical_issuance`. The list this screen shipped
 * with was written from the sidebar's names, and the API accepts an unknown
 * type without complaint and matches nobody — so "Send to pharmacies" queued
 * zero recipients and said so in a number nobody reads. Measured against
 * `/broadcast/preview` on 2026-10-15: `pharmacy` 0, `pharmacies` 7.
 */
/**
 * The API's id, and the name this dashboard already uses for it.
 *
 * `/lookups/user-types` answers English labels and ignores `Accept-Language`
 * (measured 2026-10-15), so taking its `label` straight put "Pharmacies" and
 * "Labs & Radiology" on an otherwise Arabic screen. The ids come from the API,
 * which is the half that has to be right; the words come from us, which is the
 * half that has to be readable.
 */
const TYPE_LABEL: Record<string, string> = {
  patient: 'users.patient.title',
  tourist: 'users.tourist.title',
  doctor: 'users.doctor.title',
  hospital: 'users.hospital.title',
  clinic: 'users.clinic.title',
  pharmacies: 'users.pharmacy.title',
  labs_radiology: 'users.lab.title',
  medical_insurance: 'users.issuance.title',
  home_care: 'users.home_care.title',
  physical_therapy: 'users.therapy.title',
  employment_office: 'users.employment.title',
  medical_devices: 'users.medical_devices.title',
  admin: 'notif.send.type.admin'
};

const FALLBACK_TYPES: LookupItem[] = [
  { id: 'patient', label: 'Patients' },
  { id: 'tourist', label: 'Tourists' },
  { id: 'doctor', label: 'Doctors' },
  { id: 'hospital', label: 'Hospitals' },
  { id: 'clinic', label: 'Clinics' },
  { id: 'pharmacies', label: 'Pharmacies' },
  { id: 'labs_radiology', label: 'Labs & Radiology' },
  { id: 'medical_insurance', label: 'Medical Insurance' },
  { id: 'home_care', label: 'Home Care' },
  { id: 'physical_therapy', label: 'Physical Therapy' },
  { id: 'employment_office', label: 'Employment Office' },
  { id: 'medical_devices', label: 'Medical Devices' }
];

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './notification.html',
  styleUrl: './notification.css'
})
export class Notification {
  private svc = inject(NotificationsService);
  private lookups = inject(LookupsService);
  private i18n = inject(I18nService);

  readonly titleMax = TITLE_MAX;
  readonly bodyMax = BODY_MAX;
  readonly genders: BroadcastGender[] = ['male', 'female'];

  title = signal('');
  body = signal('');

  /** `all` ignores the type list; `user_type` sends to exactly what is ticked. */
  everyone = signal(true);
  selectedTypes = signal<ReadonlySet<string>>(new Set(['patient']));
  selectedGenders = signal<ReadonlySet<BroadcastGender>>(new Set());
  selectedSpecialties = signal<ReadonlySet<number>>(new Set());
  selectedSubspecialties = signal<ReadonlySet<number>>(new Set());

  userTypes = signal<LookupItem[]>(FALLBACK_TYPES);
  specialties = signal<DoctorSpecialty[]>([]);
  subspecialties = signal<DoctorSpecialty[]>([]);

  sending = signal(false);
  successMsg = signal<string | null>(null);
  successParams = signal<Record<string, string | number>>({});
  errorMsg = signal<string | null>(null);

  reach = signal<number | null>(null);
  reachByType = signal<ReadonlyArray<{ type: string; count: number }>>([]);
  reachLoading = signal(false);
  reachFailed = signal(false);

  /** Shown under Patients and Tourists only when one of them is ticked. */
  showGender = computed(() =>
    this.everyone() || [...this.selectedTypes()].some(t => GENDERED.has(t))
  );
  showDoctorFilters = computed(() => this.everyone() || this.selectedTypes().has(DOCTOR));
  /** `user_type` with nothing ticked reaches nobody — measured, total 0. */
  nobodySelected = computed(() => !this.everyone() && this.selectedTypes().size === 0);

  titleLeft = computed(() => TITLE_MAX - this.title().length);
  bodyLeft = computed(() => BODY_MAX - this.body().length);
  tooLong = computed(() => this.titleLeft() < 0 || this.bodyLeft() < 0);

  canSend = computed(() =>
    !this.sending() &&
    !!this.title().trim() &&
    !!this.body().trim() &&
    !this.tooLong() &&
    !this.nobodySelected()
  );

  constructor() {
    this.lookups.userTypes().pipe(takeUntilDestroyed()).subscribe({
      next: rows => { if (rows?.length) this.userTypes.set(rows); this.refreshReach(); },
      // The fallback is already in place and carries the same spellings.
      error: () => this.refreshReach()
    });
    this.svc.specialties().pipe(takeUntilDestroyed()).subscribe({
      next: rows => this.specialties.set(rows ?? []),
      error: () => this.specialties.set([])
    });
  }

  /** An account type: our word for the API's id, falling back to its own. */
  label(item: LookupItem): string {
    const key = TYPE_LABEL[String(item.id)];
    if (key) {
      const text = this.i18n.translate(key);
      if (text !== key) return text;
    }
    return item.label || item.name || String(item.id);
  }

  /** A specialty: the API carries both languages on this endpoint. */
  specialtyLabel(row: DoctorSpecialty): string {
    const arabic = this.i18n.lang() === 'ar';
    return (arabic ? row.name_ar : row.name_en) || row.name || String(row.id);
  }

  // ───────────────────────────────────────────────────────── selection

  setEveryone(on: boolean): void {
    this.everyone.set(on);
    this.refreshReach();
  }

  toggleType(id: string): void {
    const next = new Set(this.selectedTypes());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedTypes.set(next);
    // Filters for a type nobody is sending to would be sent and ignored, and
    // they would keep showing a count the admin cannot see the cause of.
    if (!next.has(DOCTOR) && !this.everyone()) {
      this.selectedSpecialties.set(new Set());
      this.selectedSubspecialties.set(new Set());
      this.subspecialties.set([]);
    }
    if (![...next].some(t => GENDERED.has(t)) && !this.everyone()) {
      this.selectedGenders.set(new Set());
    }
    this.refreshReach();
  }

  toggleGender(g: BroadcastGender): void {
    const next = new Set(this.selectedGenders());
    if (next.has(g)) next.delete(g); else next.add(g);
    this.selectedGenders.set(next);
    this.refreshReach();
  }

  toggleSpecialty(id: number): void {
    const next = new Set(this.selectedSpecialties());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      this.loadSubspecialties(id);
    }
    this.selectedSpecialties.set(next);
    this.refreshReach();
  }

  toggleSubspecialty(id: number): void {
    const next = new Set(this.selectedSubspecialties());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedSubspecialties.set(next);
    this.refreshReach();
  }

  /** Subspecialties are per specialty, so the list grows as specialties are picked. */
  private loadSubspecialties(specialtyId: number): void {
    this.svc.subspecialties(specialtyId).subscribe({
      next: rows => {
        const seen = new Set(this.subspecialties().map(r => r.id));
        this.subspecialties.set([
          ...this.subspecialties(),
          ...(rows ?? []).filter(r => !seen.has(r.id))
        ]);
      },
      error: () => undefined
    });
  }

  // ───────────────────────────────────────────────────────── the target

  target(): BroadcastTarget {
    const out: BroadcastTarget = this.everyone()
      ? { type: 'all' }
      : { type: 'user_type', userTypes: [...this.selectedTypes()] };

    // Sub-filters apply under `all` too — they narrow their own type and
    // leave the others alone, so sending them is never a widening.
    if (this.selectedGenders().size) out.genders = [...this.selectedGenders()];
    if (this.selectedSpecialties().size) out.specialtyIds = [...this.selectedSpecialties()];
    if (this.selectedSubspecialties().size) out.subspecialtyIds = [...this.selectedSubspecialties()];
    return out;
  }

  // ───────────────────────────────────────────────────────── the count

  /** Debounced: a count per keystroke on a checkbox run is pointless traffic. */
  private askForReach = debounce(() => this.loadReach(), 400);

  refreshReach(): void {
    if (this.nobodySelected()) {
      this.reach.set(0);
      this.reachByType.set([]);
      this.reachFailed.set(false);
      return;
    }
    this.reachLoading.set(true);
    this.askForReach();
  }

  private loadReach(): void {
    this.svc.broadcastPreview(this.target()).subscribe({
      next: r => {
        this.reach.set(r.total);
        this.reachByType.set(
          Object.entries(r.by_user_type ?? {}).map(([type, count]) => ({ type, count: Number(count) }))
        );
        this.reachLoading.set(false);
        this.reachFailed.set(false);
      },
      error: () => {
        // A count that cannot be fetched must not read as a count of zero.
        this.reach.set(null);
        this.reachByType.set([]);
        this.reachLoading.set(false);
        this.reachFailed.set(true);
      }
    });
  }

  /**
   * `by_user_type` can name a type the lookup does not list — `admin` is in
   * every "All Users" count and is not a user type an admin can pick — so an
   * unlisted key falls back to a translated name and then to itself.
   */
  typeLabel(id: string): string {
    const hit = this.userTypes().find(t => String(t.id) === id);
    if (hit) return this.label(hit);
    return this.label({ id });
  }

  // ───────────────────────────────────────────────────────── sending

  setTitle(value: string): void { this.title.set(value); }
  setBody(value: string): void { this.body.set(value); }

  sendNotification(): void {
    if (!this.canSend()) {
      this.errorMsg.set(
        this.nobodySelected() ? 'notif.send.pick_audience' : 'notif.send.required_fields'
      );
      return;
    }

    this.sending.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.svc
      .broadcast({ title: this.title().trim(), body: this.body().trim(), target_audience: this.target() })
      .subscribe({
        next: r => {
          this.sending.set(false);
          this.successParams.set({ count: r.queued_recipients ?? 0 });
          this.successMsg.set('notif.send.queued');
          this.title.set('');
          this.body.set('');
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          // The API names the field on a 422 — a title over 200 characters
          // answers under `title`. Showing only "Validation failed" hid that.
          this.errorMsg.set(apiErrorText(err, 'notif.send.failed'));
        }
      });
  }
}
