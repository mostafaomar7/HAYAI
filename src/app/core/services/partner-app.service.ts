import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * The HAYAI Partner desktop build — the Windows app for clinics, hospitals,
 * labs and doctors. Not the patient app.
 *
 * The **link is always the page**, never the installer. The filename carries
 * its version and changes with every release (it went 1.0.0.11 → 1.0.1.12
 * inside one day), so a hard-coded `.exe` becomes a 404 on the next build,
 * and a copy on another host is refused anyway — the app checks the
 * installer's SHA-256 against the digest the gate publishes.
 *
 * The gate is used only to *say* which version the page will hand over. If it
 * cannot be reached the button still works, because the href never depended
 * on it.
 */
export const PARTNER_WINDOWS_PAGE = 'https://get.hayaihealthcare.com';

export interface PartnerWindowsBuild {
  /** Shown to people, e.g. `1.0.1`. Not the build number. */
  version_name: string;
  /** The current installer. We read it, we do not link to it — see above. */
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
