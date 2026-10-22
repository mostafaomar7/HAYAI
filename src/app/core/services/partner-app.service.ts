import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * The HAYAI Partner desktop build — the Windows app for clinics, hospitals,
 * labs and doctors. Not the patient app.
 *
 * The button hands over the **installer itself**, not the download page.
 *
 * The filename carries its version and changes with every release (it went
 * 1.0.0.11 → 1.0.1.12 inside one day), so the URL below is a starting value,
 * not the answer: the version gate publishes the current `download_url` and
 * the button swaps to it as soon as that answers. Written any other way, this
 * link is a 404 the day the next build ships.
 *
 * If the gate cannot be reached the button still works — it falls back to the
 * build named here, which is the last one we knew about.
 */
export const PARTNER_WINDOWS_INSTALLER =
  'https://get.hayaihealthcare.com/HayaiPartnerSetup-1.0.1.12.exe';

/**
 * Where the installer is served from. Nothing links to it directly; it is the
 * prefix a `download_url` from the gate has to start with before we are
 * willing to point a button at it.
 */
export const PARTNER_WINDOWS_HOST = 'https://get.hayaihealthcare.com/';

export interface PartnerWindowsBuild {
  /** Shown to people, e.g. `1.0.1`. Not the build number. */
  version_name: string;
  /** The current installer — this is what the button points at. */
  download_url: string;
  latest_build: number;
  sha256: string;
}

@Injectable({ providedIn: 'root' })
export class PartnerAppService {
  private http = inject(HttpClient);

  /**
   * Public: no token, and the two headers are what select the build. The
   * endpoint answers for any origin, so this works on the signed-out
   * marketing page as well as inside the dashboard.
   */
  windows(): Observable<PartnerWindowsBuild> {
    return this.http
      .get<{ data: PartnerWindowsBuild }>(`${environment.apiBaseUrl}/app/version-gate`, {
        headers: { 'X-Client-Platform': 'windows', 'X-Client-App': 'com.hayai.partner' }
      })
      .pipe(map(res => res.data));
  }
}
