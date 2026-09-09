import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiService } from './api.service';

export interface LookupItem {
  id: string | number;
  name?: string;
  label?: string;
  code?: string;
  specialty_id?: number;
  /**
   * Plan types only: whether an admin may create a plan of this type. Absent on
   * a server that has not shipped it yet, which reads as "allowed" rather than
   * emptying the dropdown.
   */
  sellable?: boolean;
  label_en?: string;
  label_ar?: string;
}

@Injectable({ providedIn: 'root' })
export class LookupsService {
  private api = inject(ApiService);

  private cache = new Map<string, Observable<LookupItem[]>>();

  governorates() { return this.cached('/lookups/governorates'); }
  genders() { return this.cached('/lookups/genders'); }
  userTypes() { return this.cached('/lookups/user-types'); }
  planTypes() { return this.cached('/lookups/plan-types'); }
  transactionStatuses() { return this.cached('/lookups/transaction-statuses'); }
  listingStatuses() { return this.cached('/lookups/listing-statuses'); }
  doctorRoles() { return this.cached('/lookups/doctor-roles'); }
  doctorSpecialties() { return this.cached('/lookups/doctor-specialties'); }

  doctorSubspecialties(specialtyId?: number): Observable<LookupItem[]> {
    return this.api.get<LookupItem[]>('/lookups/doctor-subspecialties', { specialty_id: specialtyId });
  }

  private cached(path: string): Observable<LookupItem[]> {
    if (!this.cache.has(path)) {
      this.cache.set(path, this.api.get<LookupItem[]>(path).pipe(shareReplay(1)));
    }
    return this.cache.get(path)!;
  }
}
