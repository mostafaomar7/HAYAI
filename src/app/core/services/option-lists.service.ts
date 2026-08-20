import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PagedResult } from './api.service';

/**
 * The lists a provider's forms read from and can never write to. They used to
 * exist only as seeders, so adding one meant a deploy; now an admin maintains
 * them. All seven are the same table with different columns, so they share one
 * service and one screen driven by `OPTION_LISTS` below.
 */
export type OptionListKey =
  | 'icu-specialty-groups'
  | 'icu-specialty-categories'
  | 'icu-specialties'
  | 'icu-team-roles'
  | 'mt-specialties'
  | 'mt-subspecialties'
  | 'insurance-providers';

export interface OptionRow {
  /**
   * The config names parent and roll-up fields as strings (`specialty_group_id`,
   * `subspecialties_count`), so rows are read by key as well as by property.
   */
  [key: string]: unknown;
  id: number;
  /**
   * The localized display value — it follows `Accept-Language` and is
   * read-only. The editable pair is `name_en` / `name_ar`.
   */
  name: string;
  name_en?: string;
  name_ar?: string;
  sort_order?: number;
  is_active?: boolean;
  /** ICU team roles: derived once from `name_en` and immutable afterwards. */
  code?: string;
  /** MT subspecialties: marks the free-text "Other" row. One per specialty. */
  is_other_option?: boolean;
  // insurance
  logo?: string | null;
  logo_url?: string | null;
  marketplace_provider_id?: number | null;
  // parents, sent flat and also expanded
  specialty_group_id?: number | null;
  specialty_category_id?: number | null;
  specialty_id?: number | null;
  group?: OptionRow | null;
  category?: OptionRow | null;
  specialty?: OptionRow | null;
  // roll-ups the backend adds so the table can show "n items"
  categories_count?: number;
  specialties_count?: number;
  subspecialties_count?: number;
  created_at?: string;
}

/** A parent select above the table, doubling as a filter and a form field. */
export interface OptionListParent {
  /** Query and body field name, e.g. `specialty_group_id`. */
  field: string;
  /** Which list the choices come from. */
  from: OptionListKey;
  labelKey: string;
  /**
   * Narrows this select by another parent's value. ICU categories belong to a
   * group, and picking a category from a different group is a 422 — so the
   * category list is filtered by the chosen group rather than left to fail.
   */
  filteredBy?: string;
}

export interface OptionListConfig {
  key: OptionListKey;
  base: string;
  titleKey: string;
  /**
   * `false` = a single `name` field instead of the `name_en` / `name_ar` pair.
   * Only the insurance directory works that way.
   */
  bilingual: boolean;
  parents: OptionListParent[];
  /** First field present on a row is shown in the "items" column. */
  countFields?: string[];
  hasSortOrder: boolean;
  hasIsActive: boolean;
  hasLogo: boolean;
  /** Generated server-side from `name_en`; sending it back is a 422. */
  hasReadonlyCode: boolean;
  hasIsOtherOption: boolean;
  /** A row with this `code` is a fallback the forms depend on — no delete. */
  protectedCode?: string;
  /**
   * Offer "deactivate instead" when a delete is refused for being in use. Only
   * meaningful where the row carries `is_active`, which providers that already
   * picked it keep rendering.
   */
  offerDeactivate: boolean;
}

export const OPTION_LISTS: Record<OptionListKey, OptionListConfig> = {
  'icu-specialty-groups': {
    key: 'icu-specialty-groups',
    base: '/admin/icu/specialty-groups',
    titleKey: 'lists.icu_groups',
    bilingual: true,
    parents: [],
    countFields: ['categories_count', 'specialties_count'],
    hasSortOrder: true,
    hasIsActive: false,
    hasLogo: false,
    hasReadonlyCode: false,
    hasIsOtherOption: false,
    offerDeactivate: false
  },
  'icu-specialty-categories': {
    key: 'icu-specialty-categories',
    base: '/admin/icu/specialty-categories',
    titleKey: 'lists.icu_categories',
    bilingual: true,
    parents: [
      { field: 'specialty_group_id', from: 'icu-specialty-groups', labelKey: 'lists.group' }
    ],
    countFields: ['specialties_count'],
    hasSortOrder: true,
    hasIsActive: false,
    hasLogo: false,
    hasReadonlyCode: false,
    hasIsOtherOption: false,
    offerDeactivate: false
  },
  'icu-specialties': {
    key: 'icu-specialties',
    base: '/admin/icu/specialties',
    titleKey: 'lists.icu_specialties',
    bilingual: true,
    parents: [
      { field: 'specialty_group_id', from: 'icu-specialty-groups', labelKey: 'lists.group' },
      {
        field: 'specialty_category_id',
        from: 'icu-specialty-categories',
        labelKey: 'lists.category',
        filteredBy: 'specialty_group_id'
      }
    ],
    hasSortOrder: true,
    hasIsActive: false,
    hasLogo: false,
    hasReadonlyCode: false,
    hasIsOtherOption: false,
    offerDeactivate: false
  },
  'icu-team-roles': {
    key: 'icu-team-roles',
    base: '/admin/icu/team-roles',
    titleKey: 'lists.icu_team_roles',
    bilingual: true,
    parents: [],
    hasSortOrder: true,
    hasIsActive: true,
    hasLogo: false,
    hasReadonlyCode: true,
    hasIsOtherOption: false,
    protectedCode: 'other',
    offerDeactivate: true
  },
  'mt-specialties': {
    key: 'mt-specialties',
    base: '/admin/medical-tourism/specialties',
    titleKey: 'lists.mt_specialties',
    bilingual: true,
    parents: [],
    countFields: ['subspecialties_count'],
    hasSortOrder: true,
    hasIsActive: false,
    hasLogo: false,
    hasReadonlyCode: false,
    hasIsOtherOption: false,
    offerDeactivate: false
  },
  'mt-subspecialties': {
    key: 'mt-subspecialties',
    base: '/admin/medical-tourism/subspecialties',
    titleKey: 'lists.mt_subspecialties',
    bilingual: true,
    parents: [
      { field: 'specialty_id', from: 'mt-specialties', labelKey: 'lists.specialty' }
    ],
    hasSortOrder: true,
    hasIsActive: false,
    hasLogo: false,
    hasReadonlyCode: false,
    hasIsOtherOption: true,
    offerDeactivate: false
  },
  'insurance-providers': {
    key: 'insurance-providers',
    base: '/admin/insurance-providers',
    titleKey: 'lists.insurance',
    bilingual: false,
    parents: [],
    hasSortOrder: false,
    hasIsActive: true,
    hasLogo: true,
    hasReadonlyCode: false,
    hasIsOtherOption: false,
    offerDeactivate: true
  }
};

export interface OptionListQuery {
  page?: number;
  per_page?: number | 'all';
  search?: string;
  [parentField: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class OptionListsService {
  private api = inject(ApiService);

  list(config: OptionListConfig, query: OptionListQuery = {}): Observable<PagedResult<OptionRow>> {
    return this.api.getPaged<OptionRow>(config.base, query);
  }

  /** Whole list, unpaginated — used to fill the parent selects. */
  all(config: OptionListConfig, query: OptionListQuery = {}): Observable<PagedResult<OptionRow>> {
    return this.list(config, { ...query, per_page: 'all' });
  }

  create(config: OptionListConfig, body: Record<string, unknown> | FormData): Observable<OptionRow> {
    return body instanceof FormData
      ? this.api.postMultipart<OptionRow>(config.base, body)
      : this.api.post<OptionRow>(config.base, body);
  }

  /**
   * Multipart cannot ride on `PUT`, so a row carrying a file is updated with
   * `POST <base>/{id}` — which the backend registers for exactly this reason.
   */
  update(
    config: OptionListConfig,
    id: number,
    body: Record<string, unknown> | FormData
  ): Observable<OptionRow> {
    return body instanceof FormData
      ? this.api.postMultipart<OptionRow>(`${config.base}/${id}`, body)
      : this.api.put<OptionRow>(`${config.base}/${id}`, body);
  }

  /** Retires a row without deleting it — it leaves every picker but survives. */
  setActive(config: OptionListConfig, id: number, isActive: boolean): Observable<OptionRow> {
    return this.api.patch<OptionRow>(`${config.base}/${id}`, { is_active: isActive });
  }

  delete(config: OptionListConfig, id: number): Observable<void> {
    return this.api.delete<void>(`${config.base}/${id}`);
  }
}
