import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TPipe } from '../../../../core/i18n/t.pipe';

/**
 * Where `adminAreaGuard` sends an admin whose role does not cover a screen.
 * Opening the screen instead would show it failing on every request, which
 * reads as a broken dashboard rather than a permission.
 */
@Component({
  selector: 'app-no-access',
  standalone: true,
  imports: [RouterLink, TPipe],
  templateUrl: './no-access.html',
  styleUrl: '../not-found/not-found.css'
})
export class NoAccess {
  private location = inject(Location);
  readonly from = inject(ActivatedRoute).snapshot.queryParamMap.get('from');

  goBack(): void {
    this.location.back();
  }
}
