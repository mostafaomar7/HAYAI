import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-charitable',
  standalone: true,
  imports: [],
  templateUrl: './charitable.html',
  styleUrl: './charitable.css',
})
export class Charitable {
  private router = inject(Router);
  
  // متغير للتحكم في ظهور واختفاء الفلتر (الصورة الرابعة)
  showFilter = false;

  // داتا وهمية للتيست
  charityList = [
    { id: 1, name: 'Resala Charity', status: 'Active' },
    { id: 2, name: 'Orman Association', status: 'Pending' },
  ];

  // 1. يروح للتفاصيل لما يدوس على الكارت نفسه (الصورة الثانية)
  goToDetails(id: number) {
    this.router.navigate(['/dashboard/charitable/details', id]);
  }

  // 2. يروح لصفحة الإضافة لما يدوس Add (الصورة الثالثة)
  goToAdd() {
    this.router.navigate(['/dashboard/charitable/add']);
  }

  // 3. يروح لصفحة التعديل لما يدوس Edit، ويمنع الكليك بتاع الكارت (الصورة الثالثة)
  goToEdit(id: number, event: Event) {
    event.stopPropagation(); // السطر ده هو السر! بيمنع إن الكارت يعمل كليك
    this.router.navigate(['/dashboard/charitable/edit', id]);
  }

  // يفتح أو يقفل قائمة الفلتر
  toggleFilter() {
    this.showFilter = !this.showFilter;
  }
}