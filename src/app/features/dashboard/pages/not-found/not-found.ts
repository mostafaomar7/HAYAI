import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TPipe } from '../../../../core/i18n/t.pipe';

/**
 * A dashboard URL that matches nothing.
 *
 * Without this route the path fell through to the app's top-level wildcard,
 * which redirects. That redirect is resolved on the **server**, where it reads
 * the stored token to decide where to send people — and the server has no
 * localStorage, so it always concluded "signed out" and answered
 * `302 /`, which then lands on the public marketing site. A signed-in admin
 * mistyping a dashboard URL was thrown out of the dashboard entirely.
 *
 * Matching here keeps the URL inside the dashboard: `dashboard/**` is
 * client-rendered, so the server returns the shell with a 200 and the browser
 * — where the session is actually visible — decides what to show.
 */
@Component({
  selector: 'app-dashboard-not-found',
  standalone: true,
  imports: [RouterLink, TPipe],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css'
})
export class DashboardNotFound {
  private location = inject(Location);
  private router = inject(Router);

  /** The address that matched nothing, so it is obvious what was mistyped. */
  readonly path = this.router.url;

  goBack(): void {
    this.location.back();
  }
}
