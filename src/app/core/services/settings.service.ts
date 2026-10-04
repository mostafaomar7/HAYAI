import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/**
 * The platform switches, as rows rather than a fixed object.
 *
 * The screen is built from whatever comes back, so a switch added on the server
 * shows up without a dashboard release. That is why nothing here enumerates the
 * keys — `type` picks the control and `group` picks the section.
 */

/** Known control types. Anything else falls back to a plain text input. */
export type SettingType = 'bool' | 'tokens' | 'int' | 'string';

export interface PlatformSetting {
  key: string;
  group: string;
  type: SettingType | string;
  value: unknown;
  default: unknown;
  /** True while nobody has changed it, so the row still shows the default. */
  is_default: boolean;
  description: string | null;
  /** Admin user id, null until someone changes it. */
  updated_by: number | null;
  updated_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(ApiService);

  list(): Observable<PlatformSetting[]> {
    return this.api.get<PlatformSetting[]>('/admin/settings');
  }

  /**
   * Only the changed keys are sent, flat (`{"ai.enabled": false}`). A bad key or
   * value is a 422 and nothing at all is saved, so the caller keeps its edits
   * and shows the errors rather than reloading.
   *
   * The response is the whole list again — replace state with it.
   */
  patch(changes: Record<string, unknown>): Observable<PlatformSetting[]> {
    return this.api.patch<PlatformSetting[]>('/admin/settings', changes);
  }
}
