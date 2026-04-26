import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-plans-details',
  standalone: true,
  imports: [],
  templateUrl: './plans-details.html',
  styleUrl: './plans-details.css',
})
export class PlansDetails {
  private location = inject(Location);
  private router = inject(Router);

  // هنا بنفترض إن الـ id جينا من الـ Route
  planId = 1; 

  goBack() {
    this.location.back();
  }

  goToEdit() {
    // بيبعت الـ ID لصفحة الإضافة عشان نعدل
    this.router.navigate(['/dashboard/plans/edit', this.planId]);
  }
}